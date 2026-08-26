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

  createApp().listen(env.PORT, () => {
    console.log(`api listening on http://localhost:${env.PORT}`);
  });
}

startServer().catch((error: unknown) => {
  console.error('api failed to start', error);
  process.exit(1);
});
