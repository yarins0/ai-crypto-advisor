import { z } from 'zod';

/**
 * Env is validated at boot rather than read ad hoc, so a missing secret fails
 * loudly on start instead of silently at the first request that needs it.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1),

  /** Signs the access-token JWTs. A short secret is brute-forceable offline. */
  JWT_ACCESS_SECRET: z.string().min(32),

  /**
   * Mixed into every refresh-token hash before storage. Read access to the
   * database alone then cannot match a captured token to its stored row, which
   * matters because a read-only database user is given to reviewers.
   */
  REFRESH_TOKEN_PEPPER: z.string().min(32),

  /** A jsonwebtoken duration string, for example '15m' or '1h'. */
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /**
   * Optional so the API still boots with no Hugging Face account configured.
   * A missing token makes the insight client throw, which the cache helper
   * degrades like any other upstream failure.
   */
  HUGGINGFACE_API_TOKEN: z.string().optional(),

  /** Configurable because free-tier model ids are deprecated without notice. */
  HUGGINGFACE_MODEL: z.string().default('meta-llama/Llama-3.1-8B-Instruct'),
});

const parsedEnv = envSchema.safeParse(process.env);

// A raw ZodError at boot is unreadable. Name the offending variables instead.
if (!parsedEnv.success) {
  const problems = parsedEnv.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

export const env = parsedEnv.data;

export const isProduction = env.NODE_ENV === 'production';
