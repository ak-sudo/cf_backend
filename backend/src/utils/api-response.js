/**
 * Standardized API Response Envelopes (CivicFlow Architectural Standards - Section 9)
 */

function successResponse(res, {
  statusCode = 200,
  message = 'Operation completed successfully',
  data = {},
  meta = undefined,
} = {}) {
  const payload = {
    success: true,
    message,
    data,
  };

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}

function errorResponse(res, {
  statusCode = 500,
  message = 'Request could not be processed',
  requestId = null,
  errors = undefined,
} = {}) {
  const payload = {
    success: false,
    message,
    requestId: requestId || (res.req && res.req.id) || undefined,
  };

  if (errors !== undefined && process.env.NODE_ENV !== 'production') {
    payload.errors = errors;
  }

  return res.status(statusCode).json(payload);
}

module.exports = {
  successResponse,
  errorResponse,
};
