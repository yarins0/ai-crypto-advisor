import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './env.js';

/**
 * The app is built separately from the listener so tests can drive it with
 * Supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
