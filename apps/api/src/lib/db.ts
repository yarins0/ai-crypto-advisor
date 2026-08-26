import mongoose from 'mongoose';

/** Mongoose pools and reconnects on its own, so no retry logic is added here. */
export async function connectDatabase(uri: string): Promise<void> {
  await mongoose.connect(uri);
  await ensureIndexes();
}

/**
 * Mongoose builds indexes in the background, so on a fresh database a write
 * can land before the unique index exists and a duplicate email would be
 * accepted. Exported because the test suite connects on its own and must
 * close the same window.
 */
export async function ensureIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
