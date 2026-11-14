const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

describe('Health Check API Endpoints', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);

    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.timestamp);
  });

  it('GET /api/v1/health returns 200 with standard response envelope', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'CivicFlow API v1 is operational');
    assert.ok(res.body.data);
    assert.equal(res.body.data.status, 'healthy');
    assert.ok(res.body.data.services);
  });

  it('GET /api/v1/non-existent-route returns 404 with standard failure envelope', async () => {
    const res = await request(app)
      .get('/api/v1/non-existent-route')
      .expect(404);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Route GET \/api\/v1\/non-existent-route not found/);
    assert.ok(res.headers['x-request-id']);
  });
});
