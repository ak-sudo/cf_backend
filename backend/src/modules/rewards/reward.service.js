const crypto = require('crypto');
const Transaction = require('./transaction.model');
const RewardItem = require('./reward-item.model');
const User = require('../users/user.model');
const Report = require('../reports/report.model');
const { REWARD_TRANSACTION_TYPES } = require('../../constants/rewards');
const { REPORT_STATUSES } = require('../../constants/reports');
const {
  NotFoundError,
  BadRequestError,
} = require('../../utils/errors');
const logger = require('../../utils/logger');
const auditService = require('../audit/audit.service');
const { seedRewardCatalog } = require('./reward.seed');

// Only these fields are exposed to citizens in the public catalog
const PUBLIC_CATALOG_FIELDS = 'title description costCoins category partnerName imageUrl stock terms';

class RewardService {
  /**
   * Retrieves active reward catalog items for citizens to redeem
   */
  async getCatalog() {
    const items = await RewardItem.find({ isActive: true })
      .select(PUBLIC_CATALOG_FIELDS)
      .sort({ costCoins: 1 })
      .lean();

    return items.map((item) => {
      const obj = { ...item, id: item._id.toString() };
      delete obj._id;
      delete obj.__v;
      return obj;
    });
  }

  /**
   * Retrieves wallet summary (current balance + recent transactions)
   */
  async getWallet(userId) {
    const user = await User.findById(userId).select('ecoCoins displayName email stats');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const [recentTransactions, totals] = await Promise.all([
      Transaction.find({ userId })
        .select('-idempotencyKey')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Transaction.aggregate([
        { $match: { userId: user._id } },
        {
          $group: {
            _id: null,
            totalEarned: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
            totalSpent: { $sum: { $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0] } },
          },
        },
      ]),
    ]);

    return {
      balance: user.ecoCoins,
      totalEarned: totals[0]?.totalEarned ?? 0,
      totalSpent: totals[0]?.totalSpent ?? 0,
      stats: user.stats,
      recentTransactions: recentTransactions.map((t) => {
        const item = { ...t, id: t._id.toString() };
        delete item._id;
        delete item.__v;
        return item;
      }),
    };
  }

  /**
   * Paginated ledger history for citizen auditability
   */
  async getHistory(userId, query) {
    const { page, limit, type } = query;
    const filter = { userId };

    if (type) {
      filter.type = type;
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .select('-idempotencyKey')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    return {
      transactions: transactions.map((t) => {
        const item = { ...t, id: t._id.toString() };
        delete item._id;
        delete item.__v;
        return item;
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Builds the receipt for a redemption ledger entry (same shape for fresh and replayed requests)
   */
  _redemptionReceipt(transaction, { isDuplicateSubmission = false } = {}) {
    return {
      transactionId: transaction._id.toString(),
      voucherCode: transaction.metadata?.voucherCode,
      rewardTitle: transaction.metadata?.rewardTitle,
      partnerName: transaction.metadata?.partnerName,
      costCoins: Math.abs(transaction.amount),
      remainingBalance: transaction.balanceAfter,
      redeemedAt: transaction.createdAt,
      isDuplicateSubmission,
    };
  }

  /**
   * Atomic reward redemption with idempotency controls and double-spend protection.
   *
   * Guarantees (without requiring a Mongo replica set):
   *  - Idempotency keys are namespaced per user, so one user can never replay or
   *    collide with another user's key (and never sees their voucher code).
   *  - Stock is reserved with a conditional atomic decrement, so finite items can't oversell.
   *  - Coins are deducted with a conditional atomic decrement, so balance can't go negative.
   *  - Any failure after a reservation is compensated (stock/coins restored), so a
   *    failed redemption never silently consumes coins.
   */
  async redeemReward(user, rewardItemId, idempotencyKey = null) {
    const ledgerKey = idempotencyKey ? `${user._id.toString()}:${idempotencyKey}` : undefined;

    // 1. Idempotency replay: only ever matches this user's own ledger entries
    if (ledgerKey) {
      const existing = await Transaction.findOne({
        userId: user._id,
        idempotencyKey: ledgerKey,
        type: REWARD_TRANSACTION_TYPES.REWARD_REDEMPTION,
      }).lean();
      if (existing) {
        logger.info({ userId: user._id }, 'Returning cached idempotent redemption');
        return this._redemptionReceipt(existing, { isDuplicateSubmission: true });
      }
    }

    // 2. Fetch reward item (fast-fail with clear messages; atomic checks follow)
    const rewardItem = await RewardItem.findById(rewardItemId);
    if (!rewardItem || !rewardItem.isActive) {
      throw new NotFoundError('Reward perk is unavailable or inactive');
    }

    if (rewardItem.stock === 0) {
      throw new BadRequestError('This reward item is currently out of stock');
    }

    if (user.ecoCoins < rewardItem.costCoins) {
      throw new BadRequestError(
        `Insufficient EcoCoins balance. Required: ${rewardItem.costCoins}, Available: ${user.ecoCoins}`
      );
    }

    const cost = rewardItem.costCoins;
    const isFiniteStock = rewardItem.stock > 0;

    // 3. Atomically reserve one unit of finite stock (prevents overselling under concurrency).
    //    The filter also re-checks isActive and cost, so a concurrent admin edit can't be bypassed.
    if (isFiniteStock) {
      const reserved = await RewardItem.findOneAndUpdate(
        { _id: rewardItem._id, isActive: true, costCoins: cost, stock: { $gt: 0 } },
        { $inc: { stock: -1 } },
        { new: true }
      );
      if (!reserved) {
        throw new BadRequestError('This reward item is no longer available. Please refresh and try again.');
      }
    }

    const releaseStock = async () => {
      if (!isFiniteStock) return;
      await RewardItem.updateOne({ _id: rewardItem._id }, { $inc: { stock: 1 } }).catch((err) =>
        logger.error({ err: err.message, rewardItemId: rewardItem._id }, 'Failed to release reserved reward stock')
      );
    };

    // 4. Atomic conditional balance deduction (prevents double spending)
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, isActive: true, ecoCoins: { $gte: cost } },
      { $inc: { ecoCoins: -cost } },
      { new: true }
    );

    if (!updatedUser) {
      await releaseStock();
      throw new BadRequestError('Transaction aborted: insufficient balance or concurrent redemption in progress');
    }

    // 5. Generate a cryptographically random voucher code
    const voucherCode = `CF-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    // 6. Write the immutable ledger record; compensate if it fails
    let transaction;
    try {
      transaction = await Transaction.create({
        userId: user._id,
        amount: -cost,
        type: REWARD_TRANSACTION_TYPES.REWARD_REDEMPTION,
        idempotencyKey: ledgerKey,
        balanceAfter: updatedUser.ecoCoins,
        description: `Redeemed: ${rewardItem.title} (${rewardItem.partnerName})`,
        metadata: {
          rewardItemId: rewardItem._id,
          rewardTitle: rewardItem.title,
          partnerName: rewardItem.partnerName,
          voucherCode,
        },
      });
    } catch (err) {
      // Roll back the coin deduction and stock reservation
      await User.updateOne({ _id: user._id }, { $inc: { ecoCoins: cost } }).catch((refundErr) =>
        logger.error({ err: refundErr.message, userId: user._id, cost }, 'CRITICAL: failed to refund EcoCoins')
      );
      await releaseStock();

      // Same key submitted concurrently: the other request won, return its receipt
      if (err && err.code === 11000 && ledgerKey) {
        const winner = await Transaction.findOne({ userId: user._id, idempotencyKey: ledgerKey }).lean();
        if (winner) {
          return this._redemptionReceipt(winner, { isDuplicateSubmission: true });
        }
      }
      throw err;
    }

    logger.info(
      {
        userId: user._id,
        rewardItemId: rewardItem._id,
        transactionId: transaction._id,
        cost,
        remaining: updatedUser.ecoCoins,
      },
      'EcoCoins reward redeemed successfully'
    );

    return this._redemptionReceipt(transaction);
  }

  /**
   * Admin: list all catalog items (optionally including inactive ones)
   */
  async listCatalogItemsForAdmin({ includeInactive = 'true' } = {}) {
    const filter = includeInactive === 'true' ? {} : { isActive: true };
    const items = await RewardItem.find(filter).sort({ isActive: -1, costCoins: 1 }).lean();
    return items.map((item) => {
      const obj = { ...item, id: item._id.toString() };
      delete obj._id;
      delete obj.__v;
      return obj;
    });
  }

  /**
   * Admin: create a catalog item (fields are pre-validated by a strict schema)
   */
  async createCatalogItem(caller, data, requestMeta = {}) {
    const item = await RewardItem.create(data);

    auditService.recordAction({
      actorId: caller._id,
      actorEmail: caller.email,
      actorRole: caller.role,
      action: 'REWARD_ITEM_CREATED',
      targetResource: 'RewardItem',
      targetId: item._id.toString(),
      changes: data,
      ipAddress: requestMeta.ipAddress || '',
      userAgent: requestMeta.userAgent || '',
    });

    return item.toJSON();
  }

  /**
   * Admin: update a catalog item. Only whitelisted fields (strict schema) reach $set.
   */
  async updateCatalogItem(caller, itemId, updates, requestMeta = {}) {
    const before = await RewardItem.findById(itemId).lean();
    if (!before) {
      throw new NotFoundError('Reward item not found');
    }

    const item = await RewardItem.findByIdAndUpdate(
      itemId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    const changes = {};
    Object.keys(updates).forEach((key) => {
      changes[key] = { from: before[key], to: updates[key] };
    });

    auditService.recordAction({
      actorId: caller._id,
      actorEmail: caller.email,
      actorRole: caller.role,
      action: 'REWARD_ITEM_UPDATED',
      targetResource: 'RewardItem',
      targetId: itemId,
      changes,
      ipAddress: requestMeta.ipAddress || '',
      userAgent: requestMeta.userAgent || '',
    });

    return item.toJSON();
  }

  /**
   * Admin: insert any missing dummy catalog items (never overwrites existing ones)
   */
  async seedDummyCatalog(caller, requestMeta = {}) {
    const result = await seedRewardCatalog();

    auditService.recordAction({
      actorId: caller._id,
      actorEmail: caller.email,
      actorRole: caller.role,
      action: 'REWARD_CATALOG_SEEDED',
      targetResource: 'RewardItem',
      changes: result,
      ipAddress: requestMeta.ipAddress || '',
      userAgent: requestMeta.userAgent || '',
    });

    return result;
  }

  /**
   * Citizen aggregate personal dashboard metrics
   */
  async getCitizenDashboard(user) {
    const [statusCounts, recentReports, wallet] = await Promise.all([
      Report.aggregate([
        { $match: { citizenId: user._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Report.find({ citizenId: user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title category status department severity createdAt')
        .lean(),
      this.getWallet(user._id),
    ]);

    const breakdown = {
      submitted: 0,
      inProgress: 0,
      resolved: 0,
      total: 0,
    };

    statusCounts.forEach((item) => {
      breakdown.total += item.count;
      if (item._id === REPORT_STATUSES.SUBMITTED || item._id === REPORT_STATUSES.ANALYZING) {
        breakdown.submitted += item.count;
      } else if (item._id === REPORT_STATUSES.IN_PROGRESS || item._id === REPORT_STATUSES.ASSIGNED) {
        breakdown.inProgress += item.count;
      } else if (item._id === REPORT_STATUSES.RESOLVED) {
        breakdown.resolved += item.count;
      }
    });

    return {
      user: {
        id: user._id.toString(),
        displayName: user.displayName,
        ecoCoins: wallet.balance,
      },
      reportBreakdown: breakdown,
      recentReports: recentReports.map((r) => {
        const item = { ...r, id: r._id.toString() };
        delete item._id;
        delete item.__v;
        return item;
      }),
      recentTransactions: wallet.recentTransactions,
      impactMetrics: {
        reportsResolvedCount: breakdown.resolved,
        ecoCoinsEarnedLifetime: wallet.totalEarned,
      },
    };
  }
}

module.exports = new RewardService();
