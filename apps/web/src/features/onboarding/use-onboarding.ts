import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import type { OnboardingQuestionsResponse } from '@aca/shared';

import { fetchOnboardingQuestions } from './api.js';

export const ONBOARDING_QUESTIONS_QUERY_KEY = ['onboarding', 'questions'];

export function useOnboardingQuestions(): UseQueryResult<OnboardingQuestionsResponse> {
  return useQuery({
    queryKey: ONBOARDING_QUESTIONS_QUERY_KEY,
    queryFn: fetchOnboardingQuestions,
    // The quiz definition is a server-side constant, so one fetch per session.
    staleTime: Infinity,
  });
}
