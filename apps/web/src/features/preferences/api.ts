import { preferencesGetResponseSchema } from '@aca/shared';
import type { PreferencesGetResponse, PreferencesRequest } from '@aca/shared';

import { apiRequest } from '../../lib/api/client.js';

const PREFERENCES_PATH = '/api/preferences';

export async function fetchPreferences(): Promise<PreferencesGetResponse> {
  return apiRequest(PREFERENCES_PATH, preferencesGetResponseSchema);
}

/** One endpoint serves both the onboarding submission and every later edit. */
export async function savePreferences(input: PreferencesRequest): Promise<PreferencesGetResponse> {
  return apiRequest(PREFERENCES_PATH, preferencesGetResponseSchema, {
    method: 'PUT',
    body: input,
  });
}
