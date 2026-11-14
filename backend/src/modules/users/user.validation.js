const { z } = require('zod');
const { ROLES, DEPARTMENTS } = require('../../constants/roles');

// MongoDB ObjectId Regex
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const userIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, { message: 'Invalid User ID format' }),
});

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(100).optional(),
  phoneNumber: z.string().trim().max(20).optional(),
  photoURL: z.string().url().max(500).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum([ROLES.CITIZEN, ROLES.ADMIN, ROLES.WORKER, ROLES.SUPER_ADMIN], {
    errorMap: () => ({ message: 'Invalid role provided' }),
  }),
  department: z.enum(DEPARTMENTS, {
    errorMap: () => ({ message: 'Invalid department provided' }),
  }).nullable().optional(),
}).refine(
  (data) => {
    if ((data.role === ROLES.ADMIN || data.role === ROLES.WORKER) && !data.department) {
      return false;
    }
    return true;
  },
  {
    message: 'Department is required for ADMIN and WORKER roles',
    path: ['department'],
  }
);

const updateStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required' }),
});

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(Object.values(ROLES)).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  isActive: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  search: z.string().trim().max(50).optional(),
});

module.exports = {
  userIdParamSchema,
  updateProfileSchema,
  updateRoleSchema,
  updateStatusSchema,
  listUsersQuerySchema,
};
