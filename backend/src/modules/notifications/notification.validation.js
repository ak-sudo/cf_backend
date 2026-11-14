const { z } = require('zod');
const { NOTIFICATION_TYPES } = require('../../constants/notifications');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const notificationIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, { message: 'Invalid notification ID format' }),
});

const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  isRead: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  type: z.enum(Object.values(NOTIFICATION_TYPES)).optional(),
});

module.exports = {
  notificationIdParamSchema,
  listNotificationsQuerySchema,
};
