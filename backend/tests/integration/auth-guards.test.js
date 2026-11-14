const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

describe('Auth & RBAC Route Protection Guards', () => {
  it('GET /api/v1/auth/me rejects with 401 when Authorization header is missing', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .expect(401);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authentication token missing/);
    assert.ok(res.body.requestId);
  });

  it('GET /api/v1/auth/me rejects with 401 when Authorization header does not use Bearer format', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
      .expect(401);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Bearer token expected/);
  });

  it('GET /api/v1/users rejects with 401 when Authorization header is missing', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .expect(401);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authentication token missing/);
  });

  it('PATCH /api/v1/users/invalid-id/role rejects with 401 when unauthenticated', async () => {
    const res = await request(app)
      .patch('/api/v1/users/invalid-id/role')
      .send({ role: 'ADMIN', department: 'ROADS' })
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('PATCH /api/v1/users/invalid-id/status rejects with 401 when unauthenticated', async () => {
    const res = await request(app)
      .patch('/api/v1/users/invalid-id/status')
      .send({ isActive: false })
      .expect(401);

    assert.equal(res.body.success, false);
  });
});
