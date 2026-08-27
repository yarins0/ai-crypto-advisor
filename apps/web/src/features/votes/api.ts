import { voteResponseSchema, votesListResponseSchema } from '@aca/shared';
import type { VoteRequest, VoteResponse, VotesListResponse } from '@aca/shared';

import { apiRequest } from '../../lib/api/client.js';

export async function fetchVotes(): Promise<VotesListResponse> {
  return apiRequest('/api/votes', votesListResponseSchema);
}

export async function castVote(input: VoteRequest): Promise<VoteResponse> {
  return apiRequest('/api/votes', voteResponseSchema, { method: 'POST', body: input });
}
