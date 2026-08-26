import { z } from 'zod';

/** Password floor is deliberately low-friction; the demo reviewer account must be typeable. */
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export const registerRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(80),
  password: passwordSchema,
});

export const loginRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: passwordSchema,
});

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  onboardedAt: z.string().datetime().nullable(),
  isDemo: z.boolean(),
});

export const authResponseSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
