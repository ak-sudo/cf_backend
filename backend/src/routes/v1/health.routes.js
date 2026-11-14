const express = require('express');
const mongoose = require('mongoose');
const { getRedisClient } = require('../../config/redis');
const { successResponse, errorResponse } = require('../../utils/api-response');

const router = express.Router();

// Liveness probe (Kubernetes / ECS ping)
router.get('/liveness', (req, res) => {
  return res.status(200).json({ status: 'alive', uptime: process.uptime() });
});

// Deep Readiness probe (checks DB & Redis dependencies)
router.get('/readiness', async (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  const redis = getRedisClient();
  const isRedisReady = redis ? redis.status === 'ready' || redis.status === 'connect' : false;

  const checks = {
    database: isDbReady ? 'connected' : 'disconnected',
    redis: isRedisReady ? 'connected' : 'disconnected',
  };

  // If in production and DB is not connected, return 503
  if (process.env.NODE_ENV === 'production' && !isDbReady) {
    return errorResponse(res, {
      statusCode: 503,
      message: 'Service unavailable: database connection unready',
      errors: checks,
    });
  }

  return successResponse(res, {
    message: 'CivicFlow API readiness check passed',
    data: {
      status: isDbReady ? 'ready' : 'degraded',
      services: checks,
    },
  });
});

router.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redis = getRedisClient();
  const redisStatus = redis ? redis.status : 'disconnected';

  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
    version: process.env.npm_package_version || '1.0.0',
  };

  return successResponse(res, {
    message: 'CivicFlow API v1 is operational',
    data: healthData,
  });
});

module.exports = router;
