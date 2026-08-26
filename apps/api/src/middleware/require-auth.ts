import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../env.js';
import { HttpError } from '../lib/errors.js';

const AUTH_SCHEME = 'bearer';
const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required';

/**
 * Gates routes behind a verified access token. Whoever holds the bearer
 * string is treated as the user with no further proof, which is exactly
 * why the access token is short-lived.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const [scheme, token] = (req.header('authorization') ?? '').split(' ');
  // RFC 7235 defines the scheme name as case-insensitive.
  if (scheme?.toLowerCase() !== AUTH_SCHEME || !token) {
    next(new HttpError(401, AUTHENTICATION_REQUIRED_MESSAGE));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof payload === 'string' || !payload.sub) {
      next(new HttpError(401, AUTHENTICATION_REQUIRED_MESSAGE));
      return;
    }
    req.userId = payload.sub;
    next();
  } catch {
    // Expired, malformed, or bad-signature tokens all collapse to the same
    // generic error — which of those it was is never revealed to the client.
    next(new HttpError(401, AUTHENTICATION_REQUIRED_MESSAGE));
  }
}
