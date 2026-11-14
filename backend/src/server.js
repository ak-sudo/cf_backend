const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { closeRedis } = require('./config/redis');
const logger = require('./utils/logger');
const { seedRewardCatalog } = require('./modules/rewards/reward.seed');

let server;

async function startServer() {
  try {
    // Attempt DB connection (non-fatal in dev/test if DB not running, but logged)
    try {
      await connectDB();

      // Development convenience: make sure the dummy rewards catalog exists.
      // Inserts only missing items; never runs in production.
      if (env.NODE_ENV === 'development') {
        await seedRewardCatalog().catch((seedErr) =>
          logger.warn({ err: seedErr.message }, 'Dummy reward catalog seeding skipped')
        );
      }
    } catch (dbErr) {
      logger.warn({ err: dbErr.message }, 'MongoDB initial connection failed - server starting in degraded mode');
    }

    server = app.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, environment: env.NODE_ENV },
        `CivicFlow API server running at http://localhost:${env.PORT}`
      );
    });

    // Graceful Shutdown
    const handleShutdown = async (signal) => {
      logger.info({ signal }, `Received ${signal}. Starting graceful shutdown...`);

      if (server) {
        server.close(async () => {
          logger.info('HTTP server closed. Cleaning up resources...');
          await disconnectDB();
          await closeRedis();
          logger.info('Cleanup complete. Process exiting gracefully.');
          process.exit(0);
        });

        // Force shutdown after 10s if connections fail to close
        setTimeout(() => {
          logger.error('Forced shutdown due to timeout while closing connections.');
          process.exit(1);
        }, 10000).unref();
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled Promise Rejection detected');
    });

    process.on('uncaughtException', (err) => {
      logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught Exception detected! Exiting process.');
      process.exit(1);
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start CivicFlow server');
    process.exit(1);
  }
}

startServer();
