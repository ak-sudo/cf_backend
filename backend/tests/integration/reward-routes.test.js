const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

describe('Rewards & Citizen Dashboard Route Protection Tests', () => {
  it('GET /api/v1/rewards/catalog rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .get('/api/v1/rewards/catalog')
      .expect(401);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Authentication token missing/);
  });

  it('GET /api/v1/rewards/wallet rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .get('/api/v1/rewards/wallet')
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('GET /api/v1/rewards/history rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .get('/api/v1/rewards/history')
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('POST /api/v1/rewards/redeem rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/v1/rewards/redeem')
      .send({ rewardItemId: '650000000000000000000001' })
      .expect(401);

    assert.equal(res.body.success, false);
  });

  it('GET /api/v1/citizen/dashboard rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .get('/api/v1/citizen/dashboard')
      .expect(401);

    assert.equal(res.body.success, false);
  });
});
