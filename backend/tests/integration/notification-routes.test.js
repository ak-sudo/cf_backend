const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

describe('Notification Routes Authentication & Guard Integration Tests', () => {
  it('GET /api/v1/notifications rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .expect(401);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authentication token missing/);
  });

  it('GET /api/v1/notifications/stream rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/stream')
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('PATCH /api/v1/notifications/read-all rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .patch('/api/v1/notifications/read-all')
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('PATCH /api/v1/notifications/:id/read rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .patch('/api/v1/notifications/650000000000000000000001/read')
      .expect(401);

    assert.equal(res.body.success, false);
  });
});
