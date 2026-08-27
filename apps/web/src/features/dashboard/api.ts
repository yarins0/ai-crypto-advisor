import { dashboardResponseSchema, memeRerollResponseSchema } from '@aca/shared';
import type { DashboardResponse, MemeRerollResponse } from '@aca/shared';

import { apiRequest } from '../../lib/api/client.js';

export async function fetchDashboard(): Promise<DashboardResponse> {
  return apiRequest('/api/dashboard', dashboardResponseSchema);
}

/** `exclude` is the meme on screen, so a re-roll does not return the same one. */
export async function fetchMemeReroll(excludeId: string): Promise<MemeRerollResponse> {
  const path = `/api/dashboard/meme?exclude=${encodeURIComponent(excludeId)}`;
  return apiRequest(path, memeRerollResponseSchema);
}
