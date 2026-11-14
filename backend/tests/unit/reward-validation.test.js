const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  redeemRewardSchema,
  listTransactionsQuerySchema,
} = require('../../src/modules/rewards/reward.validation');
const { REWARD_TRANSACTION_TYPES } = require('../../src/constants/rewards');

describe('Rewards & Ledger Validation Schema Unit Tests', () => {
  it('should accept valid redemption payload with valid ObjectId and idempotency key', () => {
    const valid = {
      rewardItemId: '650000000000000000000001',
      idempotencyKey: 'idem-key-abc-12345',
    };

    const parsed = redeemRewardSchema.safeParse(valid);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.rewardItemId, valid.rewardItemId);
  });

  it('should reject redemption with invalid ObjectId format', () => {
    const invalidId = {
      rewardItemId: 'invalid-id-format',
    };

    const parsed = redeemRewardSchema.safeParse(invalidId);
    assert.equal(parsed.success, false);
    assert.match(parsed.error.errors[0].message, /Invalid reward item ID/);
  });

  it('should validate and parse transaction query parameters', () => {
    const query = {
      page: '2',
      limit: '15',
      type: REWARD_TRANSACTION_TYPES.EARNED_REPORT_RESOLVED,
    };

    const parsed = listTransactionsQuerySchema.safeParse(query);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.page, 2);
    assert.equal(parsed.data.limit, 15);
    assert.equal(parsed.data.type, REWARD_TRANSACTION_TYPES.EARNED_REPORT_RESOLVED);
  });

  it('should reject invalid transaction type enum', () => {
    const invalidQuery = {
      type: 'INVALID_CREDIT_TYPE',
    };

    const parsed = listTransactionsQuerySchema.safeParse(invalidQuery);
    assert.equal(parsed.success, false);
  });
});
