const { Queue } = require('bullmq');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

let reportQueue = null;

function getReportQueue() {
  if (reportQueue) {
    return reportQueue;
  }

  const redisConnection = getRedisClient();

  if (!redisConnection) {
    logger.warn('Redis connection unavailable. Report analysis queue running in mock/disabled mode.');
    return null;
  }

  try {
    reportQueue = new Queue('report-analysis', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 500,
        },
      },
    });

    logger.info('BullMQ report-analysis queue initialized');
    return reportQueue;
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to initialize BullMQ report queue');
    return null;
  }
}

/**
 * Schedule an asynchronous AI analysis job for a submitted report
 */
async function scheduleReportAnalysis(report) {
  try {
    const queue = getReportQueue();

    if (!queue) {
      logger.warn({ reportId: report._id }, 'Queue unavailable; skipping async AI job dispatch');
      return null;
    }

    const job = await queue.add('analyze-report', {
      reportId: report._id.toString(),
      title: report.title,
      description: report.description,
      category: report.category,
      coordinates: report.location.coordinates,
      images: report.images.map((img) => img.url),
      submittedAt: report.createdAt,
    });

    logger.info({ reportId: report._id, jobId: job.id }, 'Dispatched report to AI analysis queue');
    return job;
  } catch (err) {
    logger.error({ err: err.message, reportId: report._id }, 'Error scheduling report analysis job');
    return null;
  }
}

module.exports = {
  getReportQueue,
  scheduleReportAnalysis,
};
