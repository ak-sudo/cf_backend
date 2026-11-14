const { z } = require('zod');
const { REPORT_STATUSES, SEVERITY_LEVELS } = require('../../constants/reports');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const taskIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, { message: 'Invalid task ID format' }),
});

const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum([
    REPORT_STATUSES.ASSIGNED,
    REPORT_STATUSES.IN_PROGRESS,
    REPORT_STATUSES.RESOLVED,
  ]).optional(),
  severity: z.enum(Object.values(SEVERITY_LEVELS)).optional(),
});

const resolveTaskSchema = z.object({
  resolutionImages: z
    .array(z.string().url().startsWith('https://', { message: 'Resolution photos must be secure HTTPS URLs' }))
    .min(1, { message: 'At least one resolution proof photo is required' })
    .max(5, { message: 'Maximum of 5 resolution photos allowed' }),
  notes: z
    .string()
    .trim()
    .min(5, { message: 'Resolution notes must be at least 5 characters long' })
    .max(1000, { message: 'Resolution notes cannot exceed 1000 characters' }),
  workerCoordinates: z
    .array(z.number())
    .length(2, { message: 'Worker coordinates must be [longitude, latitude]' })
    .refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
      message: 'Longitude must be between -180 and 180, Latitude between -90 and 90',
    })
    .optional(),
});

module.exports = {
  taskIdParamSchema,
  listTasksQuerySchema,
  resolveTaskSchema,
};
