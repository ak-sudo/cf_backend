const express = require('express');
const analyticsController = require('./analytics.controller');
const { authenticate, requireRoles } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { ROLES } = require('../../constants/roles');
const {
  analyticsFilterSchema,
  heatmapQuerySchema,
} = require('./analytics.validation');

const router = express.Router();

// Strict RBAC: Analytics is restricted to Department Administrators and Super Administrators
router.use(authenticate);
router.use(requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN));

// High-level operational overview & SLA metrics
router.get(
  '/overview',
  validate({ query: analyticsFilterSchema }),
  analyticsController.getOverview
);

// Grouped complaints by issue category
router.get(
  '/by-category',
  validate({ query: analyticsFilterSchema }),
  analyticsController.getCategoryBreakdown
);

// Geospatial issue coordinate points for map heatmaps
router.get(
  '/heatmap',
  validate({ query: heatmapQuerySchema }),
  analyticsController.getHeatmap
);

// Worker productivity and task completion metrics
router.get(
  '/workers',
  analyticsController.getWorkerLeaderboard
);

module.exports = router;
