const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { successResponse, errorResponse } = require('../../src/utils/api-response');

describe('API Response Formatter', () => {
  it('should format success response conforming to Section 9 schema', () => {
    let capturedStatus = null;
    let capturedJson = null;

    const mockRes = {
      status(code) {
        capturedStatus = code;
        return this;
      },
      json(payload) {
        capturedJson = payload;
        return this;
      },
      req: { id: 'req-123' },
    };

    successResponse(mockRes, {
      statusCode: 200,
      message: 'Reports retrieved successfully',
      data: [{ id: 1, title: 'Pothole' }],
      meta: { page: 1, limit: 10, total: 1 },
    });

    assert.equal(capturedStatus, 200);
    assert.equal(capturedJson.success, true);
    assert.equal(capturedJson.message, 'Reports retrieved successfully');
    assert.deepEqual(capturedJson.data, [{ id: 1, title: 'Pothole' }]);
    assert.deepEqual(capturedJson.meta, { page: 1, limit: 10, total: 1 });
  });

  it('should format error response conforming to Section 9 schema', () => {
    let capturedStatus = null;
    let capturedJson = null;

    const mockRes = {
      status(code) {
        capturedStatus = code;
        return this;
      },
      json(payload) {
        capturedJson = payload;
        return this;
      },
      req: { id: 'test-req-id-456' },
    };

    errorResponse(mockRes, {
      statusCode: 400,
      message: 'Invalid report data',
      requestId: 'test-req-id-456',
    });

    assert.equal(capturedStatus, 400);
    assert.equal(capturedJson.success, false);
    assert.equal(capturedJson.message, 'Invalid report data');
    assert.equal(capturedJson.requestId, 'test-req-id-456');
  });
});
