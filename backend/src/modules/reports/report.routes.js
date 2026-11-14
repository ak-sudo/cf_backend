const express = require('express');
const reportController = require('./report.controller');
const { authenticate, requireRoles } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { ROLES } = require('../../constants/roles');
const {
  reportIdParamSchema,
  createReportSchema,
  updateReportStatusSchema,
  assignWorkerSchema,
  listReportsQuerySchema,
} = require('./report.validation');

const router = express.Router();

// All report operations require authentication
router.use(authenticate);

// Generate signed Cloudinary upload signature
router.post('/upload-signature', reportController.getUploadSignature);

// Submit new civic issue report
router.post(
  '/',
  validate({ body: createReportSchema }),
  reportController.createReport
);

// List civic issue reports with RBAC scope, geospatial filter, and pagination
router.get(
  '/',
  validate({ query: listReportsQuerySchema }),
  reportController.listReports
);

// Get single report details
router.get(
  '/:id',
  validate({ params: reportIdParamSchema }),
  reportController.getReportById
);

// Assign report to field worker (Admin / Super Admin only)
router.patch(
  '/:id/assign',
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: reportIdParamSchema, body: assignWorkerSchema }),
  reportController.assignWorker
);

// Update report status (Worker / Admin / Super Admin)
router.patch(
  '/:id/status',
  requireRoles(ROLES.WORKER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: reportIdParamSchema, body: updateReportStatusSchema }),
  reportController.updateStatus
);

module.exports = router;
