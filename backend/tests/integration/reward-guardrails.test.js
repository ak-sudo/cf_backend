/**
 * Rewards endpoint guardrails: RBAC, strict validation, idempotency-key handling, rate limiting.
 * Runs the real HTTP stack with test tokens; the DB-backed user lookup and the
 * reward service are stubbed so no MongoDB is required.
 */
process.env.NODE_ENV = 'test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/modules/users/user.model');
const rewardService = require('../../src/modules/rewards/reward.service');

const ITEM_ID = '650000000000000000000001';
const originals = {};

// Each test uses a fresh uid so per-user rate-limit buckets don't interfere
function tokenFor(role) {
  const uid = `uid-${crypto.randomBytes(6).toString('hex')}`;
  return `Bearer test-token:${uid}:${uid}@example.com:${role}`;
}

before(() => {
  originals.findOne = User.findOne;
  originals.redeemReward = rewardService.redeemReward;
  originals.createCatalogItem = rewardService.createCatalogItem;
  originals.seedDummyCatalog = rewardService.seedDummyCatalog;

  // authenticate() resolves the caller from MongoDB; derive it from the test token instead
  User.findOne = async ({ firebaseUid }) => {
    const roleByUid = User.__roles || {};
    return {
      _id: { toString: () => `${firebaseUid.padEnd(24, '0').slice(0, 24)}` },
      firebaseUid,
      email: `${firebaseUid}@example.com`,
      role: roleByUid[firebaseUid],
      isActive: true,
      ecoCoins: 1000,
    };
  };

  rewardService.redeemReward = async () => ({ transactionId: 't1', voucherCode: 'CF-TEST', isDuplicateSubmission: false });
  rewardService.createCatalogItem = async (caller, data) => ({ id: ITEM_ID, ...data });
  rewardService.seedDummyCatalog = async () => ({ inserted: 0, total: 8 });
});

after(() => {
  User.findOne = originals.findOne;
  rewardService.redeemReward = originals.redeemReward;
  rewardService.createCatalogItem = originals.createCatalogItem;
  rewardService.seedDummyCatalog = originals.seedDummyCatalog;
});

// The stubbed user lookup reads the role registered for the token's uid
function auth(role) {
  const header = tokenFor(role);
  const uid = header.split(':')[1];
  User.__roles = { ...(User.__roles || {}), [uid]: role };
  return header;
}

describe('Rewards guardrails: authentication', () => {
  for (const [method, path] of [
    ['get', '/api/v1/rewards/admin/items'],
    ['post', '/api/v1/rewards/admin/items'],
    ['patch', `/api/v1/rewards/admin/items/${ITEM_ID}`],
    ['post', '/api/v1/rewards/admin/seed'],
  ]) {
    it(`${method.toUpperCase()} ${path} rejects unauthenticated requests with 401`, async () => {
      const res = await request(app)[method](path).send({}).expect(401);
      assert.equal(res.body.success, false);
    });
  }

  it('rejects forged / malformed bearer tokens with 401', async () => {
    const res = await request(app)
      .get('/api/v1/rewards/admin/items')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
    assert.equal(res.body.success, false);
  });
});

describe('Rewards guardrails: role-based access', () => {
  for (const role of ['CITIZEN', 'WORKER', 'ADMIN']) {
    it(`${role} cannot access catalog administration (403)`, async () => {
      const header = auth(role);
      await request(app).get('/api/v1/rewards/admin/items').set('Authorization', header).expect(403);
      await request(app).post('/api/v1/rewards/admin/seed').set('Authorization', header).expect(403);
      const res = await request(app)
        .post('/api/v1/rewards/admin/items')
        .set('Authorization', header)
        .send({ title: 'Free stuff', description: 'Free stuff for me', costCoins: 1, category: 'COMMUNITY', partnerName: 'Me' })
        .expect(403);
      assert.equal(res.body.success, false);
    });
  }

  for (const role of ['WORKER', 'ADMIN', 'SUPER_ADMIN']) {
    it(`${role} cannot redeem rewards (citizens only, 403)`, async () => {
      await request(app)
        .post('/api/v1/rewards/redeem')
        .set('Authorization', auth(role))
        .send({ rewardItemId: ITEM_ID })
        .expect(403);
    });
  }

  it('SUPER_ADMIN can seed the dummy catalog using the standard response envelope', async () => {
    const res = await request(app)
      .post('/api/v1/rewards/admin/seed')
      .set('Authorization', auth('SUPER_ADMIN'))
      .expect(200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.message, 'string');
    assert.deepEqual(res.body.data, { inserted: 0, total: 8 });
  });
});

describe('Rewards guardrails: redeem input validation', () => {
  it('rejects unknown fields (mass assignment such as costCoins / userId) with 422', async () => {
    const res = await request(app)
      .post('/api/v1/rewards/redeem')
      .set('Authorization', auth('CITIZEN'))
      .send({ rewardItemId: ITEM_ID, costCoins: 0, userId: ITEM_ID })
      .expect(422);
    assert.equal(res.body.success, false);
  });

  it('rejects NoSQL operator objects in rewardItemId with 422', async () => {
    await request(app)
      .post('/api/v1/rewards/redeem')
      .set('Authorization', auth('CITIZEN'))
      .send({ rewardItemId: { $ne: null } })
      .expect(422);
  });

  it('validates the Idempotency-Key header (it cannot bypass schema checks)', async () => {
    const res = await request(app)
      .post('/api/v1/rewards/redeem')
      .set('Authorization', auth('CITIZEN'))
      .set('Idempotency-Key', 'bad key:{"$gt":""}')
      .send({ rewardItemId: ITEM_ID })
      .expect(422);
    assert.equal(res.body.success, false);
  });

  it('rejects a header key that differs from the body key with 400', async () => {
    await request(app)
      .post('/api/v1/rewards/redeem')
      .set('Authorization', auth('CITIZEN'))
      .set('Idempotency-Key', 'header-key-123456')
      .send({ rewardItemId: ITEM_ID, idempotencyKey: 'body-key-1234567' })
      .expect(400);
  });

  it('accepts a valid citizen redemption and returns the standard envelope (201)', async () => {
    const res = await request(app)
      .post('/api/v1/rewards/redeem')
      .set('Authorization', auth('CITIZEN'))
      .set('Idempotency-Key', 'valid-key-12345678')
      .send({ rewardItemId: ITEM_ID })
      .expect(201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.voucherCode, 'CF-TEST');
  });

  it('rate-limits redemptions per user (6th attempt within a minute gets 429)', async () => {
    const header = auth('CITIZEN');
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/rewards/redeem')
        .set('Authorization', header)
        .send({ rewardItemId: ITEM_ID })
        .expect(201);
    }
    const res = await request(app)
      .post('/api/v1/rewards/redeem')
      .set('Authorization', header)
      .send({ rewardItemId: ITEM_ID })
      .expect(429);
    assert.equal(res.body.success, false);

    // A different user is unaffected
    await request(app)
      .post('/api/v1/rewards/redeem')
      .set('Authorization', auth('CITIZEN'))
      .send({ rewardItemId: ITEM_ID })
      .expect(201);
  });
});

describe('Rewards guardrails: admin catalog validation', () => {
  const valid = {
    title: 'Metro Day Pass',
    description: 'Unlimited rides for one day',
    costCoins: 50,
    category: 'PUBLIC_TRANSIT',
    partnerName: 'City Transit',
  };

  it('accepts a valid item (201)', async () => {
    const res = await request(app)
      .post('/api/v1/rewards/admin/items')
      .set('Authorization', auth('SUPER_ADMIN'))
      .send(valid)
      .expect(201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.item.stock, -1);
  });

  for (const [label, patch] of [
    ['negative stock below -1 (would make item unlimited)', { stock: -5 }],
    ['zero / negative cost', { costCoins: 0 }],
    ['fractional cost', { costCoins: 9.5 }],
    ['non-HTTPS image URL', { imageUrl: 'http://example.com/x.png' }],
    ['javascript: image URL', { imageUrl: 'javascript:alert(1)' }],
    ['unknown field (_id / slug override)', { _id: ITEM_ID }],
    ['invalid category', { category: 'CASH' }],
  ]) {
    it(`rejects ${label} with 422`, async () => {
      await request(app)
        .post('/api/v1/rewards/admin/items')
        .set('Authorization', auth('SUPER_ADMIN'))
        .send({ ...valid, ...patch })
        .expect(422);
    });
  }

  it('rejects an empty PATCH body with 422', async () => {
    await request(app)
      .patch(`/api/v1/rewards/admin/items/${ITEM_ID}`)
      .set('Authorization', auth('SUPER_ADMIN'))
      .send({})
      .expect(422);
  });

  it('rejects an invalid item id in the PATCH path with 422', async () => {
    await request(app)
      .patch('/api/v1/rewards/admin/items/not-an-id')
      .set('Authorization', auth('SUPER_ADMIN'))
      .send({ costCoins: 10 })
      .expect(422);
  });
});
