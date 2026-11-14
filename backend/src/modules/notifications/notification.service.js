const Notification = require('./notification.model');
const { getMessagingClient } = require('../../config/firebase');
const { NotFoundError } = require('../../utils/errors');
const logger = require('../../utils/logger');

class NotificationService {
  /**
   * Persist in-app notification and optionally dispatch FCM push notification
   */
  async createNotification({
    recipientId,
    recipientFirebaseUid,
    type,
    title,
    message,
    reportId = null,
    data = {},
    fcmToken = null,
  }) {
    try {
      const notification = await Notification.create({
        recipientId,
        recipientFirebaseUid,
        type,
        title,
        message,
        reportId,
        data,
      });

      // Asynchronous non-blocking push dispatch
      const messaging = fcmToken ? getMessagingClient() : null;
      if (messaging) {
        messaging
          .send({
            token: fcmToken,
            notification: {
              title,
              body: message,
            },
            data: {
              type,
              reportId: reportId ? reportId.toString() : '',
              notificationId: notification._id.toString(),
            },
          })
          .catch((fcmErr) => {
            logger.warn({ err: fcmErr.message, recipientId }, 'FCM push notification delivery failed');
          });
      }

      logger.info(
        { notificationId: notification._id, recipientId, type },
        'Notification created successfully'
      );

      return notification;
    } catch (err) {
      logger.error({ err: err.message, recipientId, type }, 'Failed to create in-app notification');
      return null;
    }
  }

  /**
   * Paginated list of notifications for a citizen with unread badge count
   */
  async listUserNotifications(userId, query) {
    const { page, limit, isRead, type } = query;
    const filter = { recipientId: userId };

    if (isRead !== undefined) {
      filter.isRead = isRead;
    }

    if (type) {
      filter.type = type;
    }

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipientId: userId, isRead: false }),
    ]);

    return {
      notifications: notifications.map((n) => {
        const item = { ...n, id: n._id.toString() };
        delete item._id;
        delete item.__v;
        return item;
      }),
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId, notificationId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      throw new NotFoundError('Notification not found or access denied');
    }

    return notification;
  }

  /**
   * Mark all unread notifications as read
   */
  async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return {
      markedCount: result.modifiedCount,
    };
  }

  /**
   * Chronological civic activity stream / timeline
   */
  async getActivityStream(userId, limit = 20) {
    const notifications = await Notification.find({ recipientId: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return notifications.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      reportId: n.reportId,
      metadata: n.data,
      timestamp: n.createdAt,
      isRead: n.isRead,
    }));
  }
}

module.exports = new NotificationService();
