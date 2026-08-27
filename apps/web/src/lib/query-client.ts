import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api/client.js';

const MAX_RETRIES = 2;
const SERVER_ERROR_STATUS = 500;

/**
 * Only server and network faults are worth a second attempt. A 4xx is a verdict
 * on the request itself — and a 401 has already been through the refresh-and-
 * retry path in the api client, so retrying it here only replays a dead session.
 */
function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status < SERVER_ERROR_STATUS) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

/**
 * Built per call rather than exported as a singleton so each test gets an
 * isolated cache instead of inheriting entries from the test before it.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        // Refetching on focus would silently re-roll the meme and reshuffle the
        // dashboard whenever the tab regains focus; the staleness badge already
        // tells the user how fresh the data is.
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
