import { Router } from 'express';

import { voteRequestSchema } from '@aca/shared';

import { HttpError } from '../../lib/errors.js';
import { validateBody } from '../../middleware/validate-body.js';
import { castVote, getVoteSummary } from './service.js';

const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required';

export const votesRouter: Router = Router();

votesRouter.post('/votes', validateBody(voteRequestSchema), async (req, res) => {
  if (!req.userId) {
    throw new HttpError(401, AUTHENTICATION_REQUIRED_MESSAGE);
  }
  const result = await castVote(req.userId, req.body);
  res.status(200).json(result);
});

votesRouter.get('/votes/summary', async (req, res) => {
  if (!req.userId) {
    throw new HttpError(401, AUTHENTICATION_REQUIRED_MESSAGE);
  }
  const result = await getVoteSummary(req.userId);
  res.status(200).json(result);
});
