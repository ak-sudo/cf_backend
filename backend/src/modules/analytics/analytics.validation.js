const { z } = require('zod');
const { DEPARTMENTS } = require('../../constants/roles');
const { REPORT_STATUSES, ISSUE_CATEGORIES } = require('../../constants/reports');

const timeRangeEnum = z.enum(['7d', '30d', '90d', 'year', 'all']);

const analyticsFilterSchema = z.object({
  department: z.enum(DEPARTMENTS).optional(),
  timeRange: timeRangeEnum.default('30d'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const heatmapQuerySchema = z.object({
  department: z.enum(DEPARTMENTS).optional(),
  status: z.enum(Object.values(REPORT_STATUSES)).optional(),
  category: z.enum(Object.values(ISSUE_CATEGORIES)).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  radiusMeters: z.coerce.number().int().min(500).max(100000).default(25000),
  limit: z.coerce.number().int().min(10).max(1000).default(250),
});

module.exports = {
  analyticsFilterSchema,
  heatmapQuerySchema,
};
