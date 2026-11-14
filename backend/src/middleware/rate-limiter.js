const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { errorResponse } = require('../utils/api-response');

const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(res, {
      statusCode: 429,
      message: 'Too many requests from this IP, please try again later.',
      requestId: req.id,
    });
  },
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // stricter limit for authentication attempts
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(res, {
      statusCode: 429,
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
      requestId: req.id,
    });
  },
});

// Per-user limit for coin-spending endpoints. Must run after `authenticate`,
// so the key is the authenticated user rather than a spoofable/shared IP.
const redemptionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `redeem:${req.user._id.toString()}`,
  handler: (req, res) => {
    return errorResponse(res, {
      statusCode: 429,
      message: 'Too many redemption attempts. Please wait a minute and try again.',
      requestId: req.id,
    });
  },
});

module.exports = {
  globalRateLimiter,
  authRateLimiter,
  redemptionRateLimiter,
};
