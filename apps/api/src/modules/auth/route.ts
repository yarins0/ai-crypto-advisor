import { Router } from 'express';
import type { CookieOptions, Request } from 'express';
import { rateLimit } from 'express-rate-limit';

import { loginRequestSchema, registerRequestSchema } from '@aca/shared';

import { env, isProduction } from '../../env.js';
import { HttpError } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import { getPublicUser, loginUser, registerUser, revokeRefreshToken, rotateRefreshToken } from './service.js';

const REFRESH_COOKIE_NAME = 'refresh_token';
const MS_PER_SECOND = 1000;
const SECONDS_PER_DAY = 86_400;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * MS_PER_SECOND;
const LOGIN_RATE_LIMIT_MAX_REQUESTS = 10;
const REGISTER_RATE_LIMIT_WINDOW_MS = 60 * 60 * MS_PER_SECOND;
const REGISTER_RATE_LIMIT_MAX_REQUESTS = 10;
const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid refresh token';

/**
 * Everything except the lifetime. A browser removes a cookie only when the
 * clearing response repeats the attributes it was set with, so logout reuses
 * this exact object and the two can never drift apart.
 */
const refreshCookieBaseOptions: CookieOptions = {
  // Page JavaScript cannot read this cookie, so an XSS bug cannot steal the session.
  httpOnly: true,
  // HTTPS only once deployed; off in development, where local dev is plain HTTP.
  secure: isProduction,
  // The browser never attaches this cookie to a cross-site POST, which blocks
  // CSRF on the refresh and logout routes with no CSRF-token machinery. This
  // relies on the deployment proxying the API under the web app's own
  // domain, which makes the cookie first-party.
  sameSite: 'lax',
  // Sent only on auth calls, not on every dashboard request.
  path: '/api/auth',
};

const refreshCookieOptions: CookieOptions = {
  ...refreshCookieBaseOptions,
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * SECONDS_PER_DAY * MS_PER_SECOND,
};

// Skipped in the test environment: the automated suite registers many users
// in seconds and would otherwise trip these limits during normal test runs.
const loginRateLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: LOGIN_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
});

const registerRateLimiter = rateLimit({
  windowMs: REGISTER_RATE_LIMIT_WINDOW_MS,
  limit: REGISTER_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
});

/** Reads the raw refresh token from the request cookie, if one is present. */
function readRefreshTokenCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const rawToken = cookies?.[REFRESH_COOKIE_NAME];
  return typeof rawToken === 'string' ? rawToken : undefined;
}

export const authRouter: Router = Router();

authRouter.post('/register', registerRateLimiter, validateBody(registerRequestSchema), async (req, res) => {
  const session = await registerUser(req.body);
  // The raw refresh token rides the cookie only — it must never appear in a JSON body.
  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, refreshCookieOptions);
  res.status(201).json({ user: session.user, accessToken: session.accessToken });
});

authRouter.post('/login', loginRateLimiter, validateBody(loginRequestSchema), async (req, res) => {
  const session = await loginUser(req.body);
  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, refreshCookieOptions);
  res.status(200).json({ user: session.user, accessToken: session.accessToken });
});

authRouter.post('/refresh', async (req, res) => {
  const rawToken = readRefreshTokenCookie(req);
  if (!rawToken) {
    throw new HttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }
  const session = await rotateRefreshToken(rawToken);
  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, refreshCookieOptions);
  res.status(200).json({ user: session.user, accessToken: session.accessToken });
});

authRouter.post('/logout', async (req, res) => {
  const rawToken = readRefreshTokenCookie(req);
  if (rawToken) {
    await revokeRefreshToken(rawToken);
  }
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieBaseOptions);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  // requireAuth rejects before this runs, so req.userId is always set here;
  // the guard satisfies the type without a cast.
  if (!req.userId) {
    throw new HttpError(401, 'Authentication required');
  }
  const user = await getPublicUser(req.userId);
  res.status(200).json(user);
});
