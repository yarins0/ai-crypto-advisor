import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import type { PreferencesGetResponse, PreferencesRequest } from '@aca/shared';

import { SESSION_QUERY_KEY } from '../auth/use-session.js';
import { DASHBOARD_QUERY_KEY } from '../dashboard/use-dashboard.js';
import { fetchPreferences, savePreferences } from './api.js';

export const PREFERENCES_QUERY_KEY = ['preferences'];

export function usePreferences(): UseQueryResult<PreferencesGetResponse> {
  return useQuery({ queryKey: PREFERENCES_QUERY_KEY, queryFn: fetchPreferences });
}

/**
 * Shared by the onboarding wizard and the preferences screen, because the two
 * submit the same request to the same endpoint.
 */
export function useSavePreferences(): UseMutationResult<
  PreferencesGetResponse,
  Error,
  PreferencesRequest
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: savePreferences,
    onSuccess: async () => {
      // The first write sets onboardedAt; every write changes which sections the
      // dashboard composes and bumps the version a vote echoes back. During
      // onboarding the latter two are not cached yet, so this costs nothing there.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: PREFERENCES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY }),
      ]);
    },
  });
}
