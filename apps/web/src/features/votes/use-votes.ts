import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import type { ContentType, VoteRequest, VoteResponse, VotesListResponse } from '@aca/shared';

import { ApiError } from '../../lib/api/client.js';
import { DASHBOARD_QUERY_KEY } from '../dashboard/use-dashboard.js';
import { castVote, fetchVotes } from './api.js';

const CONFLICT_STATUS = 409;

// Nested under one prefix so casting a vote can invalidate both the per-item
// list and the aggregate summary, which a vote always changes together.
export const VOTES_QUERY_KEY = ['votes'];
export const VOTES_LIST_QUERY_KEY = ['votes', 'list'];

export type VoteValue = VoteRequest['value'];

interface VoteListSnapshot {
  previous: VotesListResponse | undefined;
}

export function useVotes(): UseQueryResult<VotesListResponse> {
  return useQuery({ queryKey: VOTES_LIST_QUERY_KEY, queryFn: fetchVotes });
}

/** 0 when the item carries no vote, which is also what clears one. */
export function findVoteValue(
  votes: VotesListResponse | undefined,
  section: ContentType,
  itemId: string,
): VoteValue {
  const match = votes?.votes.find((vote) => vote.section === section && vote.itemId === itemId);
  return match?.value ?? 0;
}

function applyVote(current: VotesListResponse | undefined, input: VoteRequest): VotesListResponse {
  const others = (current?.votes ?? []).filter(
    (vote) => !(vote.section === input.section && vote.itemId === input.itemId),
  );
  if (input.value === 0) {
    return { votes: others };
  }
  // Placeholder timestamps: nothing renders them, and onSettled replaces the
  // whole row with the server's copy once the request lands.
  const nowIso = new Date().toISOString();
  return {
    votes: [
      ...others,
      {
        section: input.section,
        itemId: input.itemId,
        value: input.value,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
  };
}

export function useCastVote(): UseMutationResult<
  VoteResponse,
  Error,
  VoteRequest,
  VoteListSnapshot
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: castVote,
    onMutate: async (input) => {
      // An in-flight list refetch would otherwise land after this patch and
      // overwrite it with a server state that predates the vote.
      await queryClient.cancelQueries({ queryKey: VOTES_LIST_QUERY_KEY });
      const previous = queryClient.getQueryData<VotesListResponse>(VOTES_LIST_QUERY_KEY);
      queryClient.setQueryData<VotesListResponse>(VOTES_LIST_QUERY_KEY, (current) =>
        applyVote(current, input),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(VOTES_LIST_QUERY_KEY, context?.previous);
      // 409 means the item was served under preferences that have since
      // changed. Refetching the dashboard supplies the new preferenceVersion,
      // after which the same vote succeeds.
      if (error instanceof ApiError && error.status === CONFLICT_STATUS) {
        void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: VOTES_QUERY_KEY });
    },
  });
}
