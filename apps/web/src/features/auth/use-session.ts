import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient, UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import type { AuthResponse, LoginRequest, RegisterRequest } from '@aca/shared';

import { loadSession, login, logout, register } from './api.js';

export const SESSION_QUERY_KEY = ['session'];

/**
 * The signed-in user, or null when signed out. Held as a query rather than in a
 * context provider so React Query's own deduplication covers the boot refresh:
 * StrictMode double-invokes effects in development, and a second refresh call
 * would replay a rotated token and revoke the user's whole token family.
 */
export function useSession(): UseQueryResult<AuthResponse | null> {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: loadSession,
    // The refresh cookie outlives the tab, so re-running this on every mount
    // would spend a token rotation to learn what the cache already knows.
    staleTime: Infinity,
  });
}

/**
 * No query key carries a user id, so the entries a previous session left are
 * dropped before the new one is seeded, the same way signing out drops them.
 */
function startSession(queryClient: QueryClient, session: AuthResponse): void {
  queryClient.clear();
  // Seeded rather than invalidated: the response already is the session, so
  // refetching it would rotate a brand-new refresh token for no new data.
  queryClient.setQueryData(SESSION_QUERY_KEY, session);
}

export function useLogin(): UseMutationResult<AuthResponse, Error, LoginRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      startSession(queryClient, session);
    },
  });
}

export function useRegister(): UseMutationResult<AuthResponse, Error, RegisterRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: register,
    onSuccess: (session) => {
      startSession(queryClient, session);
    },
  });
}

export function useLogout(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      // Every cached entry belongs to the account that just left, so it is
      // dropped before the next sign-in can render another user's dashboard.
      queryClient.clear();
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    },
  });
}
