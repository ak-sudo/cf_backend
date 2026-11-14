const express = require('express');
const rewardController = require('./reward.controller');
const { authenticate, requireRoles } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { redemptionRateLimiter } = require('../../middleware/rate-limiter');
const { ROLES } = require('../../constants/roles');
const {
  redeemRewardSchema,
  listTransactionsQuerySchema,
  rewardItemIdParamSchema,
  createRewardItemSchema,
  updateRewardItemSchema,
  listAdminRewardItemsQuerySchema,
} = require('./reward.validation');

const rewardsRouter = express.Router();
const citizenDashboardRouter = express.Router();

// All rewards & wallet endpoints require user authentication
rewardsRouter.use(authenticate);

// Rewards catalog (available civic perks)
rewardsRouter.get('/catalog', rewardController.getCatalog);

// Citizen wallet balance & recent transactions
rewardsRouter.get('/wallet', rewardController.getWallet);

// Paginated audit transaction ledger
rewardsRouter.get(
  '/history',
  validate({ query: listTransactionsQuerySchema }),
  rewardController.getHistory
);

// Redeem EcoCoins for reward perk (citizens only; atomic + idempotency + per-user rate limit)
rewardsRouter.post(
  '/redeem',
  requireRoles(ROLES.CITIZEN),
  redemptionRateLimiter,
  validate({ body: redeemRewardSchema }),
  rewardController.redeemReward
);

// ----- Catalog administration (SUPER_ADMIN only, audit-logged) -----
const adminOnly = requireRoles(ROLES.SUPER_ADMIN);

rewardsRouter.get(
  '/admin/items',
  adminOnly,
  validate({ query: listAdminRewardItemsQuerySchema }),
  rewardController.listCatalogItemsForAdmin
);

rewardsRouter.post(
  '/admin/items',
  adminOnly,
  validate({ body: createRewardItemSchema }),
  rewardController.createCatalogItem
);

rewardsRouter.patch(
  '/admin/items/:id',
  adminOnly,
  validate({ params: rewardItemIdParamSchema, body: updateRewardItemSchema }),
  rewardController.updateCatalogItem
);

// Insert any missing dummy perks (idempotent; never overwrites existing items)
rewardsRouter.post('/admin/seed', adminOnly, rewardController.seedDummyCatalog);

// Citizen Dashboard Router (/api/v1/citizen)
citizenDashboardRouter.use(authenticate);
citizenDashboardRouter.get('/dashboard', rewardController.getCitizenDashboard);

module.exports = {
  rewardsRouter,
  citizenDashboardRouter,
};
