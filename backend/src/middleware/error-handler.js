const { ZodError } = require('zod');
const { AppError } = require('../utils/errors');
const { errorResponse } = require('../utils/api-response');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // If response has already started streaming, delegate to default express handler
  if (res.headersSent) {
    return next(err);
  }

  // Known AppError instances
  if (err instanceof AppError) {
    return errorResponse(res, {
      statusCode: err.statusCode,
      message: err.message,
      requestId: req.id,
      errors: err.details,
    });
  }

  // Zod schema validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return errorResponse(res, {
      statusCode: 422,
      message: 'Validation failed',
      requestId: req.id,
      errors: formattedErrors,
    });
  }

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'resource';
    return errorResponse(res, {
      statusCode: 409,
      message: `A record with this ${field} already exists`,
      requestId: req.id,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const formattedErrors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));

    return errorResponse(res, {
      statusCode: 422,
      message: 'Database validation failed',
      requestId: req.id,
      errors: formattedErrors,
    });
  }

  // Mongoose invalid ObjectId CastError
  if (err.name === 'CastError') {
    return errorResponse(res, {
      statusCode: 400,
      message: `Invalid identifier for field: ${err.path}`,
      requestId: req.id,
    });
  }

  // Log unhandled unexpected errors
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
    },
    requestId: req.id,
    url: req.originalUrl,
    method: req.method,
  }, 'Unhandled internal error occurred');

  // Generic internal server error
  return errorResponse(res, {
    statusCode: 500,
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Internal Server Error',
    requestId: req.id,
  });
}

module.exports = errorHandler;
