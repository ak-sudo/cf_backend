const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/civicflow'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(16).default('development_jwt_access_secret_key_civicflow_default'),
  JWT_REFRESH_SECRET: z.string().min(16).default('development_jwt_refresh_secret_key_civicflow_default'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables configuration:');
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

const env = parsed.data;

module.exports = env;
