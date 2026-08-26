import { defineConfig } from 'vitest/config';

/**
 * Tests share one in-memory MongoDB instance (started in src/tests/setup.ts),
 * so files must run in a single fork — parallel forks would race on the same
 * database. testTimeout/hookTimeout are raised because the first run
 * downloads a mongod binary, which can take a while.
 */
export default defineConfig({
  test: {
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    // Vitest 4 moved fork/thread tuning out of poolOptions to top-level
    // options. Disabling file parallelism keeps every test file on one
    // worker, since they all share the same in-memory MongoDB instance.
    fileParallelism: false,
  },
});
