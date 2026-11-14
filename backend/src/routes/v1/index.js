const express = require('express');
const healthRoutes = require('./health.routes');
const { authRouter, usersRouter } = require('../../modules/users/user.routes');
const reportsRouter = require('../../modules/reports/report.routes');
const { rewardsRouter, citizenDashboardRouter } = require('../../modules/rewards/reward.routes');
const workerRouter = require('../../modules/worker/worker.routes');
const analyticsRouter = require('../../modules/analytics/analytics.routes');
const notificationsRouter = require('../../modules/notifications/notification.routes');
const auditRouter = require('../../modules/audit/audit.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/reports', reportsRouter);
router.use('/rewards', rewardsRouter);
router.use('/citizen', citizenDashboardRouter);
router.use('/worker', workerRouter);
router.use('/analytics', analyticsRouter);
router.use('/notifications', notificationsRouter);
router.use('/audit', auditRouter);

module.exports = router;
