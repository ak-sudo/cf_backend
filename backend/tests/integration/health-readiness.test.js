const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

describe('Liveness and Readiness Health Probes Integration Tests', () => {
  it('GET /api/v1/health/liveness returns 200 with alive status', async () => {
    const res = await request(app)
      .get('/api/v1/health/liveness')
      .expect(200);

    assert.equal(res.body.status, 'alive');
    assert.ok(typeof res.body.uptime === 'number');
  });

  it('GET /api/v1/health/readiness returns status report for database and redis', async () => {
    const res = await request(app)
      .get('/api/v1/health/readiness')
      .expect(200);

    assert.equal(res.body.success, true);
    assert.ok(res.body.data.services);
    assert.ok('database' in res.body.data.services);
    assert.ok('redis' in res.body.data.services);
  });
});
