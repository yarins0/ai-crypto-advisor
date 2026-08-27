import { createApp } from './app.js';
import { env } from './env.js';
import { connectDatabase } from './lib/db.js';

/**
 * The database connection is opened before the listener, so a bad connection
 * string stops the process with one clear message instead of turning every
 * incoming request into a 500.
 */
async function startServer(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);

  // The insight degrades to its template silently by design, so without this a
  // misspelled variable name is indistinguishable from a cold-starting model.
  if (env.HF_TOKEN === undefined) {
    console.warn('HF_TOKEN is not set: the AI insight will serve its deterministic fallback.');
  }

  createApp().listen(env.PORT, () => {
    console.log(`api listening on http://localhost:${env.PORT}`);
  });
}

startServer().catch((error: unknown) => {
  console.error('api failed to start', error);
  process.exit(1);
});
