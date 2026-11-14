const { z } = require('zod');
const { REWARD_TRANSACTION_TYPES, REWARD_ITEM_CATEGORIES } = require('../../constants/rewards');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// Restricted charset so keys can't carry operators, separators or whitespace
const idempotencyKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{8,64}$/, {
    message: 'Idempotency key must be 8-64 characters of letters, digits, "-" or "_"',
  });

const MAX_COST_COINS = 100000;
const MAX_STOCK = 1000000;

// .strict(): reject unknown fields so callers can't smuggle e.g. costCoins/userId
const redeemRewardSchema = z
  .object({
    rewardItemId: z.string().regex(objectIdRegex, { message: 'Invalid reward item ID' }),
    idempotencyKey: idempotencyKeySchema.optional(),
  })
  .strict();

const listTransactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z.enum(Object.values(REWARD_TRANSACTION_TYPES)).optional(),
  })
  .strict();

const rewardItemIdParamSchema = z
  .object({
    id: z.string().regex(objectIdRegex, { message: 'Invalid reward item ID' }),
  })
  .strict();

const rewardItemFields = {
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(5).max(500),
  costCoins: z.number().int().positive().max(MAX_COST_COINS),
  category: z.enum(Object.values(REWARD_ITEM_CATEGORIES)),
  partnerName: z.string().trim().min(2).max(100),
  imageUrl: z.string().trim().url().startsWith('https://', { message: 'Image URL must use HTTPS' }),
  stock: z
    .number()
    .int()
    .min(-1, { message: 'Stock must be -1 (unlimited) or a non-negative count' })
    .max(MAX_STOCK),
  terms: z.string().trim().max(500),
  isActive: z.boolean(),
};

const createRewardItemSchema = z
  .object({
    ...rewardItemFields,
    imageUrl: rewardItemFields.imageUrl.optional(),
    stock: rewardItemFields.stock.default(-1),
    terms: rewardItemFields.terms.optional(),
    isActive: rewardItemFields.isActive.default(true),
  })
  .strict();

const updateRewardItemSchema = z
  .object(rewardItemFields)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided for update',
  });

const listAdminRewardItemsQuerySchema = z
  .object({
    includeInactive: z.enum(['true', 'false']).default('true'),
  })
  .strict();

module.exports = {
  idempotencyKeySchema,
  redeemRewardSchema,
  listTransactionsQuerySchema,
  rewardItemIdParamSchema,
  createRewardItemSchema,
  updateRewardItemSchema,
  listAdminRewardItemsQuerySchema,
};
