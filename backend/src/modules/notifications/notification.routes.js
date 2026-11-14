const express = require('express');
const notificationController = require('./notification.controller');
const { authenticate } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const {
  notificationIdParamSchema,
  listNotificationsQuerySchema,
} = require('./notification.validation');

const router = express.Router();

// All notification operations require authenticated citizen/user
router.use(authenticate);

// List notifications with unread badge count
router.get(
  '/',
  validate({ query: listNotificationsQuerySchema }),
  notificationController.listNotifications
);

// Unified chronological activity stream
router.get('/stream', notificationController.getActivityStream);

// Mark all unread notifications as read
router.patch('/read-all', notificationController.markAllAsRead);

// Mark single notification as read
router.patch(
  '/:id/read',
  validate({ params: notificationIdParamSchema }),
  notificationController.markAsRead
);

module.exports = router;
