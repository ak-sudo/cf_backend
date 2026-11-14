const notificationService = require('./notification.service');
const { successResponse } = require('../../utils/api-response');

class NotificationController {
  /**
   * List notifications for authenticated citizen
   */
  async listNotifications(req, res, next) {
    try {
      const result = await notificationService.listUserNotifications(req.user._id, req.query);
      return successResponse(res, {
        message: 'Notifications retrieved successfully',
        data: {
          notifications: result.notifications,
          unreadCount: result.unreadCount,
        },
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark single notification as read
   */
  async markAsRead(req, res, next) {
    try {
      const notification = await notificationService.markAsRead(req.user._id, req.params.id);
      return successResponse(res, {
        message: 'Notification marked as read',
        data: { notification },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all unread notifications as read
   */
  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(req.user._id);
      return successResponse(res, {
        message: `Marked ${result.markedCount} notifications as read`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get chronological civic activity stream
   */
  async getActivityStream(req, res, next) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
      const stream = await notificationService.getActivityStream(req.user._id, limit);
      return successResponse(res, {
        message: 'Civic activity stream retrieved successfully',
        data: { stream },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();
