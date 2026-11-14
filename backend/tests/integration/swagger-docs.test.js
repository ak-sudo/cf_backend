const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

describe('OpenAPI / Swagger Documentation Integration Tests', () => {
  it('GET /api-docs.json returns 200 and valid OpenAPI 3.0 specification', async () => {
    const res = await request(app)
      .get('/api-docs.json')
      .expect(200);

    assert.equal(res.body.openapi, '3.0.3');
    assert.equal(res.body.info.title, 'CivicFlow Unified Civic Issue Management API');
    assert.ok(res.body.paths['/reports']);
    assert.ok(res.body.paths['/worker/tasks/{id}/resolve']);
    assert.ok(res.body.paths['/rewards/redeem']);
    assert.ok(res.body.paths['/analytics/overview']);
  });

  it('GET /api-docs returns HTML documentation UI', async () => {
    const res = await request(app)
      .get('/api-docs/')
      .expect(200);

    assert.match(res.text, /Swagger UI/);
  });
});
