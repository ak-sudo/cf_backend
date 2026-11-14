const express = require('express');
const auditController = require('./audit.controller');
const { authenticate, requireRoles } = require('../../middleware/auth');
const { ROLES } = require('../../constants/roles');

const router = express.Router();

// Strict Super Admin Access Control for System Audit Trails (Directive Section 5)
router.use(authenticate);
router.use(requireRoles(ROLES.SUPER_ADMIN));

router.get('/', auditController.listLogs);

module.exports = router;
