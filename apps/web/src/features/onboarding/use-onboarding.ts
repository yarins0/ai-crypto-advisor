import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import type {
  OnboardingQuestionsResponse,
  PreferencesGetResponse,
  PreferencesRequest,
} from '@aca/shared';

import { SESSION_QUERY_KEY } from '../auth/use-session.js';
import { fetchOnboardingQuestions, savePreferences } from './api.js';

export const ONBOARDING_QUESTIONS_QUERY_KEY = ['onboarding', 'questions'];

export function useOnboardingQuestions(): UseQueryResult<OnboardingQuestionsResponse> {
  return useQuery({
    queryKey: ONBOARDING_QUESTIONS_QUERY_KEY,
    queryFn: fetchOnboardingQuestions,
    // The quiz definition is a server-side constant, so one fetch per session.
    staleTime: Infinity,
  });
}

export function useSubmitPreferences(): UseMutationResult<
  PreferencesGetResponse,
  Error,
  PreferencesRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: savePreferences,
    onSuccess: async () => {
      // The submission is what sets onboardedAt, so the cached session is now
      // wrong and the onboarding guard would send the user straight back here.
      // Refetching costs a token rotation but keeps the server the authority on
      // onboarding state rather than inventing a timestamp on the client.
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}
