const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

describe('Civic Issue Report Routes Security & Auth Tests', () => {
  it('POST /api/v1/reports rejects unauthenticated report submissions with 401', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .send({
        title: 'Road blockage due to fallen tree branch',
        description: 'Branch blocking road causing danger to vehicles.',
        coordinates: [77.1025, 28.7041],
        images: [{ url: 'https://res.cloudinary.com/civicflow/branch.jpg' }],
      })
      .expect(401);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authentication token missing/);
  });

  it('POST /api/v1/reports/upload-signature rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/v1/reports/upload-signature')
      .expect(401);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authentication token missing/);
  });

  it('GET /api/v1/reports rejects unauthenticated queries with 401', async () => {
    const res = await request(app)
      .get('/api/v1/reports')
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('PATCH /api/v1/reports/:id/assign rejects unauthenticated assignment with 401', async () => {
    const res = await request(app)
      .patch('/api/v1/reports/650000000000000000000001/assign')
      .send({ workerId: '650000000000000000000002' })
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('PATCH /api/v1/reports/:id/status rejects unauthenticated status updates with 401', async () => {
    const res = await request(app)
      .patch('/api/v1/reports/650000000000000000000001/status')
      .send({ status: 'IN_PROGRESS' })
      .expect(401);

    assert.equal(res.body.success, false);
  });
});
