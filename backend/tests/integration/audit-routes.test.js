const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

describe('System Audit Trail Route Security Integration Tests', () => {
  it('GET /api/v1/audit rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .expect(401);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authentication token missing/);
  });
});
