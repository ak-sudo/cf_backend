const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  notificationIdParamSchema,
  listNotificationsQuerySchema,
} = require('../../src/modules/notifications/notification.validation');
const { NOTIFICATION_TYPES } = require('../../src/constants/notifications');

describe('Notification Validation Schema Unit Tests', () => {
  it('should accept valid notification ObjectId parameter', () => {
    const valid = { id: '650000000000000000000001' };
    const parsed = notificationIdParamSchema.safeParse(valid);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.id, valid.id);
  });

  it('should reject invalid notification ObjectId format', () => {
    const invalid = { id: 'bad-notification-id' };
    const parsed = notificationIdParamSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
    assert.match(parsed.error.errors[0].message, /Invalid notification ID format/);
  });

  it('should validate and parse query parameters transforming isRead string to boolean', () => {
    const query = {
      page: '2',
      limit: '15',
      isRead: 'false',
      type: NOTIFICATION_TYPES.REPORT_RESOLVED,
    };

    const parsed = listNotificationsQuerySchema.safeParse(query);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.page, 2);
    assert.equal(parsed.data.limit, 15);
    assert.equal(parsed.data.isRead, false);
    assert.equal(parsed.data.type, NOTIFICATION_TYPES.REPORT_RESOLVED);
  });
});
