const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const notificationService = require('../../src/modules/notifications/notification.service');
const Notification = require('../../src/modules/notifications/notification.model');
const { NotFoundError } = require('../../src/utils/errors');

describe('Notification Service Logic & Ownership Unit Tests', () => {
  it('markAsRead should throw NotFoundError when notification does not belong to user', async () => {
    const originalFindOneAndUpdate = Notification.findOneAndUpdate;
    Notification.findOneAndUpdate = async () => null;

    try {
      await assert.rejects(
        async () => {
          await notificationService.markAsRead('user-1', '650000000000000000000001');
        },
        (err) => {
          assert.ok(err instanceof NotFoundError);
          assert.match(err.message, /Notification not found or access denied/);
          return true;
        }
      );
    } finally {
      Notification.findOneAndUpdate = originalFindOneAndUpdate;
    }
  });

  it('createNotification should catch and suppress database errors gracefully without throwing', async () => {
    const originalCreate = Notification.create;
    Notification.create = async () => {
      throw new Error('Database connection dropped');
    };

    try {
      const result = await notificationService.createNotification({
        recipientId: 'user-1',
        type: 'REPORT_SUBMITTED',
        title: 'Test',
        message: 'Test message',
      });

      // Should return null and not crash the caller
      assert.equal(result, null);
    } finally {
      Notification.create = originalCreate;
    }
  });
});
