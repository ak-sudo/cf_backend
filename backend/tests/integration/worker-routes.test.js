const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

describe('Worker Routes Authentication & Role Guards Integration Tests', () => {
  it('GET /api/v1/worker/tasks rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .get('/api/v1/worker/tasks')
      .expect(401);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authentication token missing/);
  });

  it('GET /api/v1/worker/stats rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .get('/api/v1/worker/stats')
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('PATCH /api/v1/worker/tasks/:id/start rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .patch('/api/v1/worker/tasks/650000000000000000000001/start')
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('PATCH /api/v1/worker/tasks/:id/resolve rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .patch('/api/v1/worker/tasks/650000000000000000000001/resolve')
      .send({
        resolutionImages: ['https://res.cloudinary.com/civicflow/proof.jpg'],
        notes: 'Pothole patched.',
      })
      .expect(401);

    assert.equal(res.body.success, false);
  });
});
