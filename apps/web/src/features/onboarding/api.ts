import { onboardingQuestionsResponseSchema, preferencesGetResponseSchema } from '@aca/shared';
import type {
  OnboardingQuestionsResponse,
  PreferencesGetResponse,
  PreferencesRequest,
} from '@aca/shared';

import { apiRequest } from '../../lib/api/client.js';

export async function fetchOnboardingQuestions(): Promise<OnboardingQuestionsResponse> {
  return apiRequest('/api/onboarding/questions', onboardingQuestionsResponseSchema);
}

/** The same endpoint serves the onboarding submission and later preference edits. */
export async function savePreferences(input: PreferencesRequest): Promise<PreferencesGetResponse> {
  return apiRequest('/api/preferences', preferencesGetResponseSchema, {
    method: 'PUT',
    body: input,
  });
}
