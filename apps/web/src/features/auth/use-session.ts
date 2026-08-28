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
 * dropped before the next one is seeded, on the way in and on the way out.
 */
function replaceSession(queryClient: QueryClient, session: AuthResponse | null): void {
  // The session entry is spared rather than cleared: destroying the instance the
  // route guards observe leaves its replacement unobserved, so neither a sign-in
  // nor a sign-out would redirect until a reload rebuilt the tree.
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0],
  });
  // Seeded rather than invalidated: a sign-in response already is the session,
  // so refetching it would rotate a brand-new refresh token for no new data.
  queryClient.setQueryData(SESSION_QUERY_KEY, session);
}

export function useLogin(): UseMutationResult<AuthResponse, Error, LoginRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      replaceSession(queryClient, session);
    },
  });
}

export function useRegister(): UseMutationResult<AuthResponse, Error, RegisterRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: register,
    onSuccess: (session) => {
      replaceSession(queryClient, session);
    },
  });
}

export function useLogout(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      replaceSession(queryClient, null);
    },
  });
}
