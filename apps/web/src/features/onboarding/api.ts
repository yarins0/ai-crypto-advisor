import { onboardingQuestionsResponseSchema } from '@aca/shared';
import type { OnboardingQuestionsResponse } from '@aca/shared';

import { apiRequest } from '../../lib/api/client.js';

export async function fetchOnboardingQuestions(): Promise<OnboardingQuestionsResponse> {
  return apiRequest('/api/onboarding/questions', onboardingQuestionsResponseSchema);
}
