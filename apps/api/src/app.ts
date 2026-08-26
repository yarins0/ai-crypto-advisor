import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './env.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/route.js';

/**
 * Render and Vercel each put exactly one proxy in front of the service. Express
 * must be told, or every request appears to come from the proxy's address and
 * the rate limiter treats all visitors as a single client.
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

  // Last on purpose: Express reaches an error handler only after every route
  // above has declined or thrown.
  app.use(errorHandler);

  return app;
}
