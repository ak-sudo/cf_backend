/**
 * Independently Deployed Background Worker Runner (Directive Section 4)
 * Runs BullMQ workers for async AI image classification and reporting workflows
 */
const { connectDB, disconnectDB } = require('./config/db');
const { closeRedis } = require('./config/redis');
const { startReportAnalysisWorker } = require('./workers/report-analysis.worker');
const logger = require('./utils/logger');

async function startWorkerService() {
  logger.info('Initializing CivicFlow Background Worker Process...');

  try {
    // Connect to database
    await connectDB();

    // Start BullMQ workers
    const reportWorker = startReportAnalysisWorker();

    logger.info('CivicFlow Background Workers operational and listening for jobs.');

    // Graceful Shutdown
    const handleShutdown = async (signal) => {
      logger.info({ signal }, `Received ${signal}. Shutting down worker process...`);

      if (reportWorker) {
        await reportWorker.close();
        logger.info('BullMQ report-analysis worker closed.');
      }

      await disconnectDB();
      await closeRedis();
      logger.info('Worker resources drained. Exiting cleanly.');
      process.exit(0);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    logger.fatal({ err: error.message }, 'Failed to start Background Worker Service');
    process.exit(1);
  }
}

startWorkerService();
