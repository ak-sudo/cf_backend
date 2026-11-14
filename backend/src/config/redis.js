const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

let redisClient = null;

function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
    });

    redisClient.on('error', (err) => {
      logger.error({ err: err.message }, 'Redis connection error');
    });

    return redisClient;
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Redis client');
    return null;
  }
}

async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Disconnected from Redis');
    } catch (err) {
      logger.error({ err }, 'Error closing Redis connection');
    } finally {
      redisClient = null;
    }
  }
}

module.exports = {
  getRedisClient,
  closeRedis,
};
