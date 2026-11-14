const { z } = require('zod');
const {
  ISSUE_CATEGORIES,
  REPORT_STATUSES,
  SEVERITY_LEVELS,
} = require('../../constants/reports');
const { DEPARTMENTS } = require('../../constants/roles');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const reportIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, { message: 'Invalid report ID format' }),
});

const reportImageSchema = z.object({
  url: z.string().url({ message: 'Image must be a valid URL' }).startsWith('https://', {
    message: 'Images must be served over secure HTTPS',
  }),
  publicId: z.string().trim().optional().default(''),
});

const createReportSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, { message: 'Title must be at least 5 characters long' })
    .max(150, { message: 'Title cannot exceed 150 characters' }),
  description: z
    .string()
    .trim()
    .min(10, { message: 'Description must be at least 10 characters long' })
    .max(2000, { message: 'Description cannot exceed 2000 characters' }),
  category: z
    .enum(Object.values(ISSUE_CATEGORIES), {
      errorMap: () => ({ message: 'Invalid issue category' }),
    })
    .default(ISSUE_CATEGORIES.OTHER),
  coordinates: z
    .array(z.number())
    .length(2, { message: 'Coordinates must be exactly [longitude, latitude]' })
    .refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
      message: 'Longitude must be between -180 and 180, Latitude between -90 and 90',
    }),
  address: z.string().trim().max(300).optional().default(''),
  landmark: z.string().trim().max(150).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  postalCode: z.string().trim().max(20).optional().default(''),
  images: z
    .array(reportImageSchema)
    .min(1, { message: 'At least one verified photo is required' })
    .max(5, { message: 'Maximum of 5 photos allowed per report' }),
});

const updateReportStatusSchema = z.object({
  status: z.enum(Object.values(REPORT_STATUSES), {
    errorMap: () => ({ message: 'Invalid report status' }),
  }),
  notes: z.string().trim().max(1000).optional().default(''),
  resolutionImages: z
    .array(z.string().url().startsWith('https://'))
    .max(5)
    .optional(),
});

const assignWorkerSchema = z.object({
  workerId: z.string().regex(objectIdRegex, { message: 'Invalid worker user ID format' }),
});

const listReportsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(Object.values(REPORT_STATUSES)).optional(),
  category: z.enum(Object.values(ISSUE_CATEGORIES)).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  severity: z.enum(Object.values(SEVERITY_LEVELS)).optional(),
  assignedWorkerId: z.string().regex(objectIdRegex).optional(),
  citizenId: z.string().regex(objectIdRegex).optional(),
  // Geospatial filtering
  longitude: z.coerce.number().min(-180).max(180).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  radiusMeters: z.coerce.number().int().min(100).max(50000).default(5000),
});

module.exports = {
  reportIdParamSchema,
  createReportSchema,
  updateReportStatusSchema,
  assignWorkerSchema,
  listReportsQuerySchema,
};
