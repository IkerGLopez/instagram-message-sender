import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // Instagram
  INSTAGRAM_APP_ID: z.string().min(1),
  INSTAGRAM_APP_SECRET: z.string().min(1),
  INSTAGRAM_PAGE_ACCESS_TOKEN: z.string().min(1),
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().min(1),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Trigger keyword for comment matching
  TRIGGER_KEYWORD: z.string().min(1),

  // Static discount code (required)
  STATIC_DISCOUNT_CODE: z.string().min(1),

  // Environment
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  return result.data;
}

export const env = parseEnv();
