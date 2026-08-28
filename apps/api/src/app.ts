import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './env.js';
import { errorHandler } from './middleware/error-handler.js';
import { requireAuth } from './middleware/require-auth.js';
import { requireOnboarded } from './middleware/require-onboarded.js';
import { authRouter } from './modules/auth/route.js';
import { dashboardRouter } from './modules/dashboard/route.js';
import { preferencesRouter } from './modules/preferences/route.js';
import { votesRouter } from './modules/votes/route.js';

/**
 * Two proxies sit in front of this — Vercel's rewrite and Render's — but only the
 * hop Render appends is trusted: the Render URL is publicly reachable, so trusting
 * Vercel's as well would make req.ip a forgeable X-Forwarded-For on that path.
 * The cost is a per-edge rather than per-visitor key; route.ts sizes for it.
 */
const TRUSTED_PROXY_HOPS = 1;

/**
 * The app is built separately from the listener so tests can drive it with
 * Supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.set('trust proxy', TRUSTED_PROXY_HOPS);

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', requireAuth, preferencesRouter);

  // requireOnboarded is mounted here rather than per route so a later route
  // cannot be added to either router without a preference document behind it.
  app.use('/api', requireAuth, requireOnboarded, dashboardRouter);
  app.use('/api', requireAuth, requireOnboarded, votesRouter);

  // Last on purpose: Express reaches an error handler only after every route
  // above has declined or thrown.
  app.use(errorHandler);

  return app;
}
