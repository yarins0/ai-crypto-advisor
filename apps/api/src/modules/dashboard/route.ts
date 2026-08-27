import { Router } from 'express';

import { HttpError } from '../../lib/errors.js';
import { buildDashboard, rerollMeme } from './service.js';

const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required';

export const dashboardRouter: Router = Router();

dashboardRouter.get('/dashboard', async (req, res) => {
  // requireAuth and requireOnboarded (mounted ahead of this router) reject
  // before this runs, so the guard below satisfies the type without a cast.
  if (!req.userId) {
    throw new HttpError(401, AUTHENTICATION_REQUIRED_MESSAGE);
  }
  const dashboard = await buildDashboard(req.userId);
  res.status(200).json(dashboard);
});

dashboardRouter.get('/dashboard/meme', async (req, res) => {
  if (!req.userId) {
    throw new HttpError(401, AUTHENTICATION_REQUIRED_MESSAGE);
  }
  const excludeId = typeof req.query.exclude === 'string' ? req.query.exclude : undefined;
  res.status(200).json({ meme: rerollMeme(excludeId) });
});
