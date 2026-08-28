import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { SESSION_QUERY_KEY } from '../features/auth/use-session.js';
import { ApiError } from './api/client.js';

const MAX_RETRIES = 2;
const UNAUTHORIZED_STATUS = 401;
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
  /**
   * A 401 reaching here has already been through the api client's refresh and
   * retry, so the session is unrecoverable. Dropping it hands the route guards
   * a signed-out state to redirect on; leaving it cached strands the user on a
   * dead screen displaying the API's own error text.
   */
  const endSessionOnUnauthorized = (error: Error): void => {
    if (error instanceof ApiError && error.status === UNAUTHORIZED_STATUS) {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    }
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: endSessionOnUnauthorized }),
    mutationCache: new MutationCache({ onError: endSessionOnUnauthorized }),
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

  return queryClient;
}
