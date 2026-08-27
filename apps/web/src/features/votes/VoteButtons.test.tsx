import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VoteResponse, VotesListResponse } from '@aca/shared';

import { ApiError } from '../../lib/api/client.js';
import { createQueryClient } from '../../lib/query-client.js';
import { VoteButtons } from './VoteButtons.js';
import { castVote, fetchVotes } from './api.js';

vi.mock('./api.js', () => ({ fetchVotes: vi.fn(), castVote: vi.fn() }));

const PREFERENCE_VERSION = 3;

const EXISTING_UPVOTE: VotesListResponse = {
  votes: [
    {
      section: 'prices',
      itemId: 'bitcoin',
      value: 1,
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
    },
  ],
};

function renderVoteButtons(queryClient: QueryClient = createQueryClient()): QueryClient {
  render(
    <QueryClientProvider client={queryClient}>
      <VoteButtons section="prices" itemId="bitcoin" preferenceVersion={PREFERENCE_VERSION} />
    </QueryClientProvider>,
  );
  return queryClient;
}

function upvoteButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Upvote' });
}

beforeEach(() => {
  vi.mocked(fetchVotes).mockResolvedValue({ votes: [] });
  vi.mocked(castVote).mockResolvedValue({ vote: null } as VoteResponse);
});

describe('VoteButtons', () => {
  // The whole point of the optimistic path: the control reflects the vote
  // while the request is still in flight, not after it comes back.
  it('shows the vote as cast before the request resolves', async () => {
    const user = userEvent.setup();
    vi.mocked(castVote).mockReturnValue(new Promise<VoteResponse>(() => undefined));
    renderVoteButtons();

    await user.click(upvoteButton());

    expect(upvoteButton()).toHaveAttribute('aria-pressed', 'true');
  });

  it('rolls the control back when the request fails', async () => {
    const user = userEvent.setup();
    vi.mocked(castVote).mockRejectedValue(new ApiError(500, 'Internal server error'));
    renderVoteButtons();

    await user.click(upvoteButton());

    await waitFor(() => {
      expect(upvoteButton()).toHaveAttribute('aria-pressed', 'false');
    });
  });

  // A 409 says the item was served under preferences that have since changed,
  // so the dashboard has to be refetched before the vote can succeed.
  it('refetches the dashboard when the preference version has moved on', async () => {
    const user = userEvent.setup();
    vi.mocked(castVote).mockRejectedValue(new ApiError(409, 'Preferences changed'));
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderVoteButtons(queryClient);

    await user.click(upvoteButton());

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });
  });

  it('clears the vote when the direction already cast is pressed again', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchVotes).mockResolvedValue(EXISTING_UPVOTE);
    renderVoteButtons();

    await waitFor(() => {
      expect(upvoteButton()).toHaveAttribute('aria-pressed', 'true');
    });
    await user.click(upvoteButton());

    expect(vi.mocked(castVote).mock.calls[0]?.[0]).toEqual({
      section: 'prices',
      itemId: 'bitcoin',
      preferenceVersion: PREFERENCE_VERSION,
      value: 0,
    });
  });
});
