const rewardService = require('./reward.service');
const { successResponse } = require('../../utils/api-response');
const { BadRequestError } = require('../../utils/errors');
const { idempotencyKeySchema } = require('./reward.validation');

function requestMeta(req) {
  return { ipAddress: req.ip || '', userAgent: String(req.headers['user-agent'] || '').slice(0, 300) };
}

class RewardController {
  /**
   * Get active rewards catalog
   */
  async getCatalog(req, res, next) {
    try {
      const items = await rewardService.getCatalog();
      return successResponse(res, {
        message: 'Reward perks catalog retrieved successfully',
        data: { items },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get wallet balance and recent ledger activity
   */
  async getWallet(req, res, next) {
    try {
      const wallet = await rewardService.getWallet(req.user._id);
      return successResponse(res, {
        message: 'Wallet balance retrieved successfully',
        data: wallet,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get paginated transaction history
   */
  async getHistory(req, res, next) {
    try {
      const { transactions, pagination } = await rewardService.getHistory(req.user._id, req.query);
      return successResponse(res, {
        message: 'Transaction history retrieved successfully',
        data: { transactions },
        meta: pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Redeem EcoCoins for reward perk
   */
  async redeemReward(req, res, next) {
    try {
      // The header is validated with the same schema as the body field, so it can't bypass checks
      const headerKey = req.headers['idempotency-key'];
      const bodyKey = req.body.idempotencyKey;
      if (headerKey !== undefined && bodyKey !== undefined && headerKey !== bodyKey) {
        throw new BadRequestError('Idempotency-Key header and body idempotencyKey must match');
      }
      const rawKey = headerKey ?? bodyKey;
      const idempotencyKey = rawKey === undefined ? null : idempotencyKeySchema.parse(rawKey);

      const receipt = await rewardService.redeemReward(
        req.user,
        req.body.rewardItemId,
        idempotencyKey
      );

      return successResponse(res, {
        statusCode: receipt.isDuplicateSubmission ? 200 : 201,
        message: receipt.isDuplicateSubmission
          ? 'Reward perk already redeemed for this request'
          : 'Reward perk redeemed successfully',
        data: receipt,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: list full catalog including inactive items
   */
  async listCatalogItemsForAdmin(req, res, next) {
    try {
      const items = await rewardService.listCatalogItemsForAdmin(req.query);
      return successResponse(res, {
        message: 'Reward catalog items retrieved successfully',
        data: { items },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: create catalog item
   */
  async createCatalogItem(req, res, next) {
    try {
      const item = await rewardService.createCatalogItem(req.user, req.body, requestMeta(req));
      return successResponse(res, {
        statusCode: 201,
        message: 'Reward item created successfully',
        data: { item },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: update catalog item
   */
  async updateCatalogItem(req, res, next) {
    try {
      const item = await rewardService.updateCatalogItem(req.user, req.params.id, req.body, requestMeta(req));
      return successResponse(res, {
        message: 'Reward item updated successfully',
        data: { item },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: insert missing dummy catalog items
   */
  async seedDummyCatalog(req, res, next) {
    try {
      const result = await rewardService.seedDummyCatalog(req.user, requestMeta(req));
      return successResponse(res, {
        message: result.inserted > 0
          ? `Seeded ${result.inserted} dummy reward item(s)`
          : 'Dummy reward catalog already initialized',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get citizen aggregated dashboard summary
   */
  async getCitizenDashboard(req, res, next) {
    try {
      const dashboard = await rewardService.getCitizenDashboard(req.user);
      return successResponse(res, {
        message: 'Citizen dashboard metrics retrieved successfully',
        data: dashboard,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RewardController();
