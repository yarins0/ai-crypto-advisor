import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library unmounts automatically only when Vitest globals are enabled.
// This project imports test helpers explicitly, matching the API workspace, so
// the teardown is registered by hand — without it, rendered trees from one test
// stay in the document and queries in the next test match stale nodes.
afterEach(cleanup);
