const express = require('express');
const userController = require('./user.controller');
const { authenticate, requireRoles } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { authRateLimiter } = require('../../middleware/rate-limiter');
const { ROLES } = require('../../constants/roles');
const {
  userIdParamSchema,
  updateProfileSchema,
  updateRoleSchema,
  updateStatusSchema,
  listUsersQuerySchema,
} = require('./user.validation');

const authRouter = express.Router();
const usersRouter = express.Router();

// ==========================================
// User Self-Management & Firebase Sync (/api/v1/auth)
// ==========================================
authRouter.post('/sync', authRateLimiter, authenticate, userController.syncUser);
authRouter.get('/me', authenticate, userController.getMe);
authRouter.patch(
  '/me',
  authenticate,
  validate({ body: updateProfileSchema }),
  userController.updateMe
);

// ==========================================
// Administrative RBAC User Management (/api/v1/users)
// ==========================================
usersRouter.use(authenticate);

// List users (Admin restricted to department, Super Admin all)
usersRouter.get(
  '/',
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  validate({ query: listUsersQuerySchema }),
  userController.listUsers
);

// Get single user details
usersRouter.get(
  '/:id',
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: userIdParamSchema }),
  userController.getUserById
);

// Update user role and department
usersRouter.patch(
  '/:id/role',
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: userIdParamSchema, body: updateRoleSchema }),
  userController.updateUserRole
);

// Activate / Deactivate user account
usersRouter.patch(
  '/:id/status',
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: userIdParamSchema, body: updateStatusSchema }),
  userController.updateUserStatus
);

module.exports = {
  authRouter,
  usersRouter,
};
