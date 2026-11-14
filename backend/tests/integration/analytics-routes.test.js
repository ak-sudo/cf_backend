const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

describe('Analytics Routes Authentication & Authorization Integration Tests', () => {
  it('GET /api/v1/analytics/overview rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .expect(401);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authentication token missing/);
  });

  it('GET /api/v1/analytics/by-category rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/by-category')
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('GET /api/v1/analytics/heatmap rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/heatmap')
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('GET /api/v1/analytics/workers rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/workers')
      .expect(401);

    assert.equal(res.body.success, false);
  });
});
