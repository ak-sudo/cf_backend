const express = require('express');
const workerController = require('./worker.controller');
const { authenticate, requireRoles } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { ROLES } = require('../../constants/roles');
const {
  taskIdParamSchema,
  listTasksQuerySchema,
  resolveTaskSchema,
} = require('./worker.validation');

const router = express.Router();

// Strict Worker RBAC Guard: Only users with the WORKER role can access
router.use(authenticate);
router.use(requireRoles(ROLES.WORKER));

// List tasks assigned to the worker
router.get(
  '/tasks',
  validate({ query: listTasksQuerySchema }),
  workerController.listTasks
);

// Worker operational statistics
router.get('/stats', workerController.getStats);

// Get single assigned task details
router.get(
  '/tasks/:id',
  validate({ params: taskIdParamSchema }),
  workerController.getTaskDetails
);

// Mark task as IN_PROGRESS
router.patch(
  '/tasks/:id/start',
  validate({ params: taskIdParamSchema }),
  workerController.startTask
);

// Resolve task with proof photos and notes
router.patch(
  '/tasks/:id/resolve',
  validate({ params: taskIdParamSchema, body: resolveTaskSchema }),
  workerController.resolveTask
);

module.exports = router;
