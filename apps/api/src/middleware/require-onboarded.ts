import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../lib/errors.js';
import { UserModel } from '../modules/auth/user.model.js';

const ONBOARDING_REQUIRED_MESSAGE = 'Onboarding required';

/**
 * Gates the routes that read a preference document. 403 rather than 401 —
 * the caller is authenticated, just not yet eligible — which is what lets the
 * client route them to onboarding instead of back to the login screen.
 *
 * Checks the user rather than loading the preference so the guard stays
 * independent of whatever data the handler behind it happens to need.
 */
export async function requireOnboarded(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // Not redundant with requireAuth: Mongoose strips undefined values from a
  // query, so an absent userId would widen this to "any onboarded user exists"
  // and the guard would pass for an unauthenticated caller.
  if (!req.userId) {
    next(new HttpError(401, 'Authentication required'));
    return;
  }

  const isOnboarded = await UserModel.exists({
    _id: req.userId,
    onboardedAt: { $ne: null },
  });

  if (!isOnboarded) {
    next(new HttpError(403, ONBOARDING_REQUIRED_MESSAGE));
    return;
  }

  next();
}
