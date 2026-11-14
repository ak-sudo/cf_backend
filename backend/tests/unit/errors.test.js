const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
} = require('../../src/utils/errors');

describe('Domain & HTTP Errors Hierarchy', () => {
  it('should instantiate AppError with defaults and operational flag', () => {
    const err = new AppError('Something broke', 500);
    assert.equal(err.message, 'Something broke');
    assert.equal(err.statusCode, 500);
    assert.equal(err.isOperational, true);
  });

  it('should instantiate BadRequestError with 400', () => {
    const err = new BadRequestError('Bad input');
    assert.equal(err.statusCode, 400);
    assert.equal(err.message, 'Bad input');
  });

  it('should instantiate UnauthorizedError with 401', () => {
    const err = new UnauthorizedError();
    assert.equal(err.statusCode, 401);
    assert.equal(err.message, 'Unauthorized access');
  });

  it('should instantiate ForbiddenError with 403', () => {
    const err = new ForbiddenError();
    assert.equal(err.statusCode, 403);
  });

  it('should instantiate NotFoundError with 404', () => {
    const err = new NotFoundError('Complaint not found');
    assert.equal(err.statusCode, 404);
  });

  it('should instantiate ConflictError with 409', () => {
    const err = new ConflictError('Email already registered');
    assert.equal(err.statusCode, 409);
  });

  it('should instantiate ValidationError with 422', () => {
    const err = new ValidationError('Invalid location coordinates');
    assert.equal(err.statusCode, 422);
  });

  it('should instantiate TooManyRequestsError with 429', () => {
    const err = new TooManyRequestsError();
    assert.equal(err.statusCode, 429);
  });
});
