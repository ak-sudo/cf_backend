const { z } = require('zod');
const {
  ISSUE_CATEGORIES,
  SEVERITY_LEVELS,
  CATEGORY_DEPARTMENT_MAP,
} = require('../constants/reports');
const { DEPARTMENTS } = require('../constants/roles');
const logger = require('../utils/logger');

const aiServiceResponseSchema = z.object({
  success: z.boolean().default(true),
  report_id: z.string().nullable().optional(),
  predicted_category: z.enum(Object.values(ISSUE_CATEGORIES)).default(ISSUE_CATEGORIES.OTHER),
  recommended_department: z.enum(DEPARTMENTS).default('GENERAL'),
  severity: z.enum(Object.values(SEVERITY_LEVELS)).default(SEVERITY_LEVELS.LOW),
  severity_score: z.number().int().min(1).max(5).default(2),
  confidence: z.number().min(0).max(1).default(0.85),
  fraud_score: z.number().min(0).max(1).default(0.0),
  ai_report: z.object({
    summary: z.string().default(''),
    key_observations: z.array(z.string()).default([]),
    immediate_hazards: z.array(z.string()).default([]),
    recommended_action: z.string().default(''),
    estimated_repair_urgency: z.string().default('STANDARD'),
  }),
  model_version: z.string().max(100).default('unknown'),
  processed_at: z.string().optional(),
});

// Confidence reported by the keyword fallback. Deliberately below the worker's 0.70
// auto-routing threshold so a keyword guess is always sent for human review.
const FALLBACK_CONFIDENCE = 0.5;

class GemmaAIService {
  constructor() {
    this.serviceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000/api/v1/classify';
    // Claude vision analysis with adaptive thinking can take 20-60s; stay above the AI service's own 90s limit
    this.timeoutMs = parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '120000', 10);
    // Shared secret checked by the AI service (X-Internal-Api-Key)
    this.internalApiKey = process.env.AI_SERVICE_API_KEY || '';
  }

  /**
   * Dispatches citizen report and photographs to Gemma 4 Vision AI
   */
  async classifyAndGenerateReport({
    reportId,
    title,
    description,
    images = [],
    coordinates = null,
  }) {
    const payload = {
      report_id: reportId ? reportId.toString() : null,
      title: title || 'Civic Issue',
      description: description || 'Visual report',
      image_urls: Array.isArray(images) && images.length > 0 ? images : ['https://civicflow.local/placeholder.jpg'],
      coordinates: coordinates || null,
    };

    // Attempt HTTP call to Python Gemma 4 Microservice if running
    if (process.env.NODE_ENV !== 'test') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const headers = { 'Content-Type': 'application/json' };
        if (this.internalApiKey) {
          headers['X-Internal-Api-Key'] = this.internalApiKey;
        }

        let response;
        try {
          response = await fetch(this.serviceUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        if (response.ok) {
          const rawJson = await response.json();
          const parsed = aiServiceResponseSchema.parse(rawJson);
          logger.info(
            { reportId, model: parsed.model_version, confidence: parsed.confidence },
            'AI agent inference complete'
          );
          return this._formatResult(parsed);
        }

        const detail = await response.text().catch(() => '');
        logger.warn(
          { reportId, status: response.status, detail: detail.slice(0, 300) },
          'AI service rejected the analysis request; using keyword fallback (flagged for review)'
        );
      } catch (httpErr) {
        logger.warn(
          { reportId, err: httpErr.name === 'AbortError' ? `timeout after ${this.timeoutMs}ms` : httpErr.message },
          'AI service unavailable; using keyword fallback (flagged for review)'
        );
      }
    }

    // Embedded in-process Gemma civic intelligence fallback (Directive Section 7)
    return this._runEmbeddedGemmaEngine(payload);
  }

  _runEmbeddedGemmaEngine(payload) {
    const { title, description, image_urls } = payload;
    const text = `${title} ${description} ${image_urls.join(' ')}`.toLowerCase();

    let category = ISSUE_CATEGORIES.OTHER;
    let severity = SEVERITY_LEVELS.MEDIUM;
    let severityScore = 3;
    let confidence = FALLBACK_CONFIDENCE;
    let urgency = 'STANDARD';

    if (text.includes('carcass') || text.includes('dead animal')) {
      category = ISSUE_CATEGORIES.ANIMAL_CARCASS;
      severity = SEVERITY_LEVELS.CRITICAL;
      severityScore = 5;
      urgency = 'EMERGENCY';
    } else if (text.includes('water') || text.includes('leak') || text.includes('pipe') || text.includes('sewage')) {
      category = ISSUE_CATEGORIES.WATER_LEAKAGE;
      severity = SEVERITY_LEVELS.HIGH;
      severityScore = 4;
      urgency = 'EXPEDITE';
    } else if (text.includes('wire') || text.includes('spark') || text.includes('electric') || text.includes('broken pole')) {
      category = ISSUE_CATEGORIES.BROKEN_INFRASTRUCTURE;
      severity = text.includes('wire') ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM;
      severityScore = severity === SEVERITY_LEVELS.HIGH ? 4 : 3;
    } else if (text.includes('garbage') || text.includes('trash') || text.includes('waste') || text.includes('dump')) {
      category = ISSUE_CATEGORIES.GARBAGE;
      severity = text.includes('huge') || text.includes('toxic') ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM;
      severityScore = severity === SEVERITY_LEVELS.HIGH ? 4 : 2;
    } else if (text.includes('sign') || text.includes('board') || text.includes('signal')) {
      category = ISSUE_CATEGORIES.DAMAGED_SIGNBOARD;
      severity = SEVERITY_LEVELS.MEDIUM;
      severityScore = 3;
    } else if (text.includes('graffiti') || text.includes('spray') || text.includes('vandalism')) {
      category = ISSUE_CATEGORIES.GRAFFITI;
      severity = SEVERITY_LEVELS.LOW;
      severityScore = 1;
    } else if (text.includes('pothole') || text.includes('crater') || (text.includes('road') && (text.includes('damage') || text.includes('crack') || text.includes('hazard')))) {
      category = ISSUE_CATEGORIES.POTHOLE;
      if (text.includes('deep') || text.includes('massive') || text.includes('accident') || text.includes('highway')) {
        severity = SEVERITY_LEVELS.HIGH;
        severityScore = 4;
        urgency = 'EXPEDITE';
      }
    }

    let department = CATEGORY_DEPARTMENT_MAP[category] || 'GENERAL';
    if (category === ISSUE_CATEGORIES.BROKEN_INFRASTRUCTURE && (text.includes('wire') || text.includes('electric'))) {
      department = 'ELECTRICITY';
    }

    const rawResult = {
      predicted_category: category,
      recommended_department: department,
      severity,
      severity_score: severityScore,
      confidence,
      fraud_score: 0.02,
      ai_report: {
        summary: `Automated keyword triage (AI vision analysis unavailable) suggests ${category.toLowerCase().replace(/_/g, ' ')}. Pending human review before routing to ${department}.`,
        key_observations: [
          `Visual indicators matching ${category.toLowerCase().replace('_', ' ')}.`,
          `Estimated community impact level: ${severity}.`,
          `Designated jurisdiction: ${department}.`,
        ],
        immediate_hazards: [
          category === ISSUE_CATEGORIES.POTHOLE
            ? 'Traffic collision or suspension damage risk'
            : category === ISSUE_CATEGORIES.ANIMAL_CARCASS || category === ISSUE_CATEGORIES.GARBAGE
            ? 'Public health and sanitation hazard'
            : department === 'ELECTRICITY'
            ? 'Live electrical wire danger'
            : 'General civic disruption',
        ],
        recommended_action: `Dispatch field crew from Department of ${department} for inspection and repair.`,
        estimated_repair_urgency: urgency,
      },
      model_version: 'keyword-fallback',
      processed_at: new Date().toISOString(),
    };

    return this._formatResult(rawResult);
  }

  _formatResult(data) {
    return {
      predictedCategory: data.predicted_category,
      recommendedDepartment: data.recommended_department,
      severity: data.severity,
      severityScore: data.severity_score,
      confidence: data.confidence,
      fraudScore: data.fraud_score,
      aiReport: {
        summary: data.ai_report.summary,
        keyObservations: data.ai_report.key_observations,
        immediateHazards: data.ai_report.immediate_hazards,
        recommendedAction: data.ai_report.recommended_action,
        estimatedRepairUrgency: data.ai_report.estimated_repair_urgency,
      },
      modelVersion: data.model_version || 'unknown',
      tags: [
        data.model_version === 'keyword-fallback' ? 'keyword-fallback' : 'ai-agent',
        data.predicted_category.toLowerCase(),
        data.recommended_department.toLowerCase(),
      ],
    };
  }
}

module.exports = new GemmaAIService();
