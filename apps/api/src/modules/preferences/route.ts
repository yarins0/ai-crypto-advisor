import { Router } from 'express';

import { preferencesRequestSchema } from '@aca/shared';

import { HttpError } from '../../lib/errors.js';
import { validateBody } from '../../middleware/validate-body.js';
import { getOnboardingQuestions, getPreferences, upsertPreferences } from './service.js';

const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required';

export const preferencesRouter: Router = Router();

preferencesRouter.get('/onboarding/questions', async (_req, res) => {
  res.status(200).json({ questions: getOnboardingQuestions() });
});

preferencesRouter.get('/preferences', async (req, res) => {
  // requireAuth (mounted ahead of this router) rejects before this runs, so
  // the guard below satisfies the type without a cast.
  if (!req.userId) {
    throw new HttpError(401, AUTHENTICATION_REQUIRED_MESSAGE);
  }
  const preferences = await getPreferences(req.userId);
  res.status(200).json({ preferences });
});

preferencesRouter.put('/preferences', validateBody(preferencesRequestSchema), async (req, res) => {
  if (!req.userId) {
    throw new HttpError(401, AUTHENTICATION_REQUIRED_MESSAGE);
  }
  const preferences = await upsertPreferences(req.userId, req.body);
  res.status(200).json({ preferences });
});
