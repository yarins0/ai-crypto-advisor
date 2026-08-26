import mongoose from 'mongoose';

/**
 * Opens the shared mongoose connection. Mongoose already pools connections
 * and reconnects on drop, so no retry logic is added here.
 */
export async function connectDatabase(uri: string): Promise<void> {
  await mongoose.connect(uri);
  await ensureIndexes();
}

/**
 * Mongoose builds a schema's indexes in the background once the model is
 * compiled, so on a brand-new database a write can land before its unique
 * index exists — and a duplicate email would be accepted instead of rejected.
 * Awaiting every registered model closes that window before traffic is served.
 *
 * Exported because the test suite connects on its own and must close the same
 * window before it asserts that a duplicate email is rejected.
 */
export async function ensureIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

/** Closes the shared mongoose connection, used by tests and shutdown hooks. */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
