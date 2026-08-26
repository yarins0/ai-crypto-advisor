import { z } from 'zod';

/**
 * Env is validated at boot rather than read ad hoc, so a missing secret fails
 * loudly on start instead of silently at the first request that needs it.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
});

export const env = envSchema.parse(process.env);
