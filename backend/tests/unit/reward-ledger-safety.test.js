const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const rewardService = require('../../src/modules/rewards/reward.service');
const RewardItem = require('../../src/modules/rewards/reward-item.model');
const { BadRequestError, NotFoundError } = require('../../src/utils/errors');

describe('EcoCoins Ledger & Redemption Safety Unit Tests', () => {
  it('redeemReward should throw NotFoundError if reward item does not exist', async () => {
    // Stub findById to return null
    const originalFindById = RewardItem.findById;
    RewardItem.findById = async () => null;

    try {
      const mockUser = { _id: 'user-1', ecoCoins: 100 };
      await assert.rejects(
        async () => {
          await rewardService.redeemReward(mockUser, '650000000000000000000001');
        },
        (err) => {
          assert.ok(err instanceof NotFoundError);
          assert.match(err.message, /Reward perk is unavailable/);
          return true;
        }
      );
    } finally {
      RewardItem.findById = originalFindById;
    }
  });

  it('redeemReward should throw BadRequestError if reward item is out of stock', async () => {
    const originalFindById = RewardItem.findById;
    RewardItem.findById = async () => ({
      _id: '650000000000000000000001',
      title: 'Metro Pass Discount',
      costCoins: 50,
      stock: 0, // Out of stock
      isActive: true,
    });

    try {
      const mockUser = { _id: 'user-1', ecoCoins: 100 };
      await assert.rejects(
        async () => {
          await rewardService.redeemReward(mockUser, '650000000000000000000001');
        },
        (err) => {
          assert.ok(err instanceof BadRequestError);
          assert.match(err.message, /out of stock/);
          return true;
        }
      );
    } finally {
      RewardItem.findById = originalFindById;
    }
  });

  it('redeemReward should throw BadRequestError if citizen balance is less than perk cost', async () => {
    const originalFindById = RewardItem.findById;
    RewardItem.findById = async () => ({
      _id: '650000000000000000000001',
      title: 'Solar Lamp Coupon',
      costCoins: 200,
      stock: 10,
      isActive: true,
    });

    try {
      const mockUser = { _id: 'user-1', ecoCoins: 50 }; // Only 50 coins available, needs 200
      await assert.rejects(
        async () => {
          await rewardService.redeemReward(mockUser, '650000000000000000000001');
        },
        (err) => {
          assert.ok(err instanceof BadRequestError);
          assert.match(err.message, /Insufficient EcoCoins balance/);
          return true;
        }
      );
    } finally {
      RewardItem.findById = originalFindById;
    }
  });
});

describe('EcoCoins redemption atomicity & compensation', () => {
  const Transaction = require('../../src/modules/rewards/transaction.model');
  const User = require('../../src/modules/users/user.model');

  const ITEM = {
    _id: '650000000000000000000001',
    title: 'Bike Share',
    partnerName: 'GreenWheels',
    costCoins: 100,
    stock: 5,
    isActive: true,
  };
  const user = { _id: { toString: () => 'user-a' }, ecoCoins: 500 };

  function stubAll(overrides = {}) {
    const calls = { userUpdateOne: [], itemUpdateOne: [], findOneFilters: [] };
    const saved = {
      tFindOne: Transaction.findOne,
      tCreate: Transaction.create,
      iFindById: RewardItem.findById,
      iFindOneAndUpdate: RewardItem.findOneAndUpdate,
      iUpdateOne: RewardItem.updateOne,
      uFindOneAndUpdate: User.findOneAndUpdate,
      uUpdateOne: User.updateOne,
    };
    Transaction.findOne = (filter) => {
      calls.findOneFilters.push(filter);
      return { lean: async () => (overrides.existing ? overrides.existing(filter) : null) };
    };
    Transaction.create = overrides.create || (async (doc) => ({ ...doc, _id: 'tx-1', createdAt: new Date() }));
    RewardItem.findById = async () => ITEM;
    RewardItem.findOneAndUpdate = overrides.reserve || (async () => ({ ...ITEM, stock: ITEM.stock - 1 }));
    RewardItem.updateOne = async (...args) => { calls.itemUpdateOne.push(args); return {}; };
    User.findOneAndUpdate = overrides.deduct || (async () => ({ ecoCoins: user.ecoCoins - ITEM.costCoins }));
    User.updateOne = async (...args) => { calls.userUpdateOne.push(args); return {}; };
    const restore = () => {
      Transaction.findOne = saved.tFindOne;
      Transaction.create = saved.tCreate;
      RewardItem.findById = saved.iFindById;
      RewardItem.findOneAndUpdate = saved.iFindOneAndUpdate;
      RewardItem.updateOne = saved.iUpdateOne;
      User.findOneAndUpdate = saved.uFindOneAndUpdate;
      User.updateOne = saved.uUpdateOne;
    };
    return { calls, restore };
  }

  it('scopes idempotency replay lookups to the calling user and namespaces the key', async () => {
    const { calls, restore } = stubAll({
      existing: () => ({ _id: 'tx-old', amount: -100, balanceAfter: 400, metadata: { voucherCode: 'CF-OLD' } }),
    });
    try {
      const receipt = await rewardService.redeemReward(user, ITEM._id, 'my-key-12345');
      assert.equal(receipt.isDuplicateSubmission, true);
      assert.equal(receipt.voucherCode, 'CF-OLD');
      assert.equal(calls.findOneFilters[0].userId, user._id);
      assert.equal(calls.findOneFilters[0].idempotencyKey, 'user-a:my-key-12345');
    } finally {
      restore();
    }
  });

  it('does not deduct coins when stock reservation fails (sold out concurrently)', async () => {
    let deducted = false;
    const { restore } = stubAll({
      reserve: async () => null,
      deduct: async () => { deducted = true; return null; },
    });
    try {
      await assert.rejects(rewardService.redeemReward(user, ITEM._id), /no longer available/);
      assert.equal(deducted, false);
    } finally {
      restore();
    }
  });

  it('releases reserved stock when the coin deduction fails', async () => {
    const { calls, restore } = stubAll({ deduct: async () => null });
    try {
      await assert.rejects(rewardService.redeemReward(user, ITEM._id), /insufficient balance/);
      assert.equal(calls.itemUpdateOne.length, 1);
      assert.deepEqual(calls.itemUpdateOne[0][1], { $inc: { stock: 1 } });
    } finally {
      restore();
    }
  });

  it('refunds coins and releases stock when the ledger write fails', async () => {
    const { calls, restore } = stubAll({ create: async () => { throw new Error('write failed'); } });
    try {
      await assert.rejects(rewardService.redeemReward(user, ITEM._id), /write failed/);
      assert.deepEqual(calls.userUpdateOne[0][1], { $inc: { ecoCoins: 100 } });
      assert.deepEqual(calls.itemUpdateOne[0][1], { $inc: { stock: 1 } });
    } finally {
      restore();
    }
  });

  it('on a concurrent duplicate key, refunds this attempt and returns the winning receipt', async () => {
    let lookups = 0;
    const { calls, restore } = stubAll({
      existing: () => (lookups++ === 0 ? null : { _id: 'tx-win', amount: -100, balanceAfter: 400, metadata: { voucherCode: 'CF-WIN' } }),
      create: async () => { const e = new Error('dup'); e.code = 11000; throw e; },
    });
    try {
      const receipt = await rewardService.redeemReward(user, ITEM._id, 'same-key-1234');
      assert.equal(receipt.voucherCode, 'CF-WIN');
      assert.equal(receipt.isDuplicateSubmission, true);
      assert.deepEqual(calls.userUpdateOne[0][1], { $inc: { ecoCoins: 100 } });
    } finally {
      restore();
    }
  });
});
