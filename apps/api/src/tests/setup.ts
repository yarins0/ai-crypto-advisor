import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { ensureIndexes } from '../lib/db.js';

// env.ts validates process.env at import time, so the required variables
// must exist before any test file (or the app) imports it. A beforeAll hook
// runs too late for that — vitest imports the test file (and so app.ts and
// env.ts) during collection, before any hook body executes. Top-level await
// in this setup file blocks that import until everything below is ready.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-at-least-32-chars-long';
process.env.REFRESH_TOKEN_PEPPER = 'test-refresh-token-pepper-at-least-32-chars';

// Binary download on a cold cache can be slow, hence the generous hookTimeout
// in vitest.config.ts (setupFiles execution shares that timeout budget).
const mongoMemoryServer = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongoMemoryServer.getUri();
await mongoose.connect(mongoMemoryServer.getUri());

// Models register themselves when the test file imports the app, which happens
// after this file's top-level code but before any hook body. So this is the
// earliest point at which there are indexes to wait for — and without the wait,
// a write can beat its own unique index and let a duplicate email through.
beforeAll(async () => {
  await ensureIndexes();
});

afterEach(async () => {
  // Clear every collection so one test's data cannot leak into the next.
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoMemoryServer.stop();
}, 60000);
