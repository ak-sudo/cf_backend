const { Worker } = require('bullmq');
const { getRedisClient } = require('../config/redis');
const Report = require('../modules/reports/report.model');
const gemmaService = require('../services/gemma.service');
const notificationService = require('../modules/notifications/notification.service');
const { NOTIFICATION_TYPES } = require('../constants/notifications');
const {
  ISSUE_CATEGORIES,
  REPORT_STATUSES,
  SEVERITY_LEVELS,
  AI_PROCESSING_STATUS,
  CATEGORY_DEPARTMENT_MAP,
} = require('../constants/reports');
const logger = require('../utils/logger');

/**
 * Validates untrusted AI inference output against strict schemas (Directive Section 7)
 */
function validateAIInference(aiResult) {
  if (!aiResult || typeof aiResult !== 'object') {
    throw new Error('AI output must be a valid JSON object');
  }

  const allowedCategories = Object.values(ISSUE_CATEGORIES);
  const allowedSeverities = Object.values(SEVERITY_LEVELS);

  const category = allowedCategories.includes(aiResult.predictedCategory)
    ? aiResult.predictedCategory
    : ISSUE_CATEGORIES.OTHER;

  const confidence = typeof aiResult.confidence === 'number'
    ? Math.max(0, Math.min(1, aiResult.confidence))
    : 0.5;

  const estimatedSeverity = allowedSeverities.includes(aiResult.estimatedSeverity)
    ? aiResult.estimatedSeverity
    : SEVERITY_LEVELS.LOW;

  const fraudScore = typeof aiResult.fraudScore === 'number'
    ? Math.max(0, Math.min(1, aiResult.fraudScore))
    : 0;

  return {
    predictedCategory: category,
    confidence,
    estimatedSeverity,
    fraudScore,
    tags: Array.isArray(aiResult.tags) ? aiResult.tags.slice(0, 10) : [],
    modelVersion: aiResult.modelVersion || 'v1.0.0-civic-net',
  };
}

/**
 * Mock/Default inference engine (can be hooked to Python microservice or Gemini API)
 */
async function runInference(jobData) {
  const { title, description, category } = jobData;

  // Keyword / heuristics-based fallback analysis
  let predictedCategory = category || ISSUE_CATEGORIES.OTHER;
  let estimatedSeverity = SEVERITY_LEVELS.LOW;
  let confidence = 0.88;

  const text = `${title} ${description}`.toLowerCase();

  if (text.includes('pothole') || text.includes('road') || text.includes('crater')) {
    predictedCategory = ISSUE_CATEGORIES.POTHOLE;
    estimatedSeverity = text.includes('large') || text.includes('accident') ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM;
  } else if (text.includes('garbage') || text.includes('trash') || text.includes('waste') || text.includes('dump')) {
    predictedCategory = ISSUE_CATEGORIES.GARBAGE;
    estimatedSeverity = SEVERITY_LEVELS.MEDIUM;
  } else if (text.includes('carcass') || text.includes('dead animal')) {
    predictedCategory = ISSUE_CATEGORIES.ANIMAL_CARCASS;
    estimatedSeverity = SEVERITY_LEVELS.CRITICAL;
  } else if (text.includes('water') || text.includes('leak') || text.includes('pipe') || text.includes('sewage')) {
    predictedCategory = ISSUE_CATEGORIES.WATER_LEAKAGE;
    estimatedSeverity = SEVERITY_LEVELS.HIGH;
  } else if (text.includes('light') || text.includes('lamp') || text.includes('broken pole')) {
    predictedCategory = ISSUE_CATEGORIES.BROKEN_INFRASTRUCTURE;
  }

  return {
    predictedCategory,
    confidence,
    estimatedSeverity,
    fraudScore: 0.02,
    tags: ['civic_infrastructure', predictedCategory.toLowerCase()],
    modelVersion: 'v1.0.0-civic-classifier',
  };
}

function startReportAnalysisWorker() {
  const redisConnection = getRedisClient();

  if (!redisConnection) {
    logger.warn('Redis unavailable; AI Analysis worker not started');
    return null;
  }

  const worker = new Worker(
    'report-analysis',
    async (job) => {
      const { reportId } = job.data;
      logger.info({ jobId: job.id, reportId }, 'Processing AI analysis job');

      const report = await Report.findById(reportId);
      if (!report) {
        logger.warn({ reportId }, 'Report not found during AI job execution. Discarding.');
        return;
      }

      // Mark status as ANALYZING
      report.aiAnalysis.status = AI_PROCESSING_STATUS.PROCESSING;
      await report.save();

      try {
        const aiResult = await gemmaService.classifyAndGenerateReport(job.data);

        // Low confidence predictions flagged for human review (Directive Section 7)
        const isLowConfidence = aiResult.confidence < 0.7;

        report.aiAnalysis = {
          status: isLowConfidence ? AI_PROCESSING_STATUS.FLAGGED_FOR_REVIEW : AI_PROCESSING_STATUS.COMPLETED,
          predictedCategory: aiResult.predictedCategory,
          recommendedDepartment: aiResult.recommendedDepartment,
          confidence: aiResult.confidence,
          estimatedSeverity: aiResult.severity,
          fraudScore: aiResult.fraudScore,
          tags: aiResult.tags,
          processedAt: new Date(),
          modelVersion: aiResult.modelVersion,
          reviewReason: isLowConfidence ? 'Model confidence below acceptable threshold (0.70)' : null,
          aiReport: aiResult.aiReport,
        };

        // Automatically assign recommended department and category if high confidence
        if (!isLowConfidence) {
          if (report.category === ISSUE_CATEGORIES.OTHER) {
            report.category = aiResult.predictedCategory;
          }
          report.department = aiResult.recommendedDepartment;
        }

        report.severity = aiResult.severity;
        report.status = isLowConfidence ? REPORT_STATUSES.PENDING_REVIEW : REPORT_STATUSES.SUBMITTED;

        await report.save();

        // Notify citizen that Gemma 4 analysis is complete
        notificationService.createNotification({
          recipientId: report.citizenId,
          type: NOTIFICATION_TYPES.REPORT_ANALYZED,
          title: 'AI Analysis Complete',
          message: `Gemma 4 analyzed your report: Identified as ${report.category} (${report.severity} severity), routed to Department of ${report.department}.`,
          reportId: report._id,
          data: {
            predictedCategory: report.category,
            department: report.department,
            severity: report.severity,
            summary: aiResult.aiReport.summary,
          },
        });

        logger.info(
          {
            reportId: report._id,
            category: report.category,
            department: report.department,
            severity: report.severity,
            confidence: aiResult.confidence,
          },
          'Gemma 4 AI analysis completed and persisted'
        );
      } catch (inferenceErr) {
        logger.error({ err: inferenceErr.message, reportId }, 'AI inference failure');
        report.aiAnalysis.status = AI_PROCESSING_STATUS.FAILED;
        report.aiAnalysis.reviewReason = inferenceErr.message;
        await report.save();
        throw inferenceErr; // Triggers BullMQ retry policy
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Report analysis job failed all retries');
  });

  logger.info('BullMQ report-analysis worker running (concurrency: 5)');
  return worker;
}

module.exports = {
  startReportAnalysisWorker,
  validateAIInference,
  runInference,
};
