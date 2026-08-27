import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import type { DashboardResponse, MemeRerollResponse } from '@aca/shared';

import { fetchDashboard, fetchMemeReroll } from './api.js';

export const DASHBOARD_QUERY_KEY = ['dashboard'];

export function useDashboard(): UseQueryResult<DashboardResponse> {
  return useQuery({ queryKey: DASHBOARD_QUERY_KEY, queryFn: fetchDashboard });
}

export function useRerollMeme(): UseMutationResult<MemeRerollResponse, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fetchMemeReroll,
    onSuccess: (response) => {
      // Patched into the cached response rather than invalidating it: wanting a
      // different meme is no reason to refetch prices, news and the AI insight,
      // each of which costs an upstream call.
      queryClient.setQueryData<DashboardResponse>(DASHBOARD_QUERY_KEY, (current) =>
        current ? { ...current, sections: { ...current.sections, memes: response.meme } } : current,
      );
    },
  });
}
