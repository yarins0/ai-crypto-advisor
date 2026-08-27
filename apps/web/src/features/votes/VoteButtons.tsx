import type { ContentType } from '@aca/shared';

import { VoteButton } from './VoteButton.js';
import { findVoteValue, useCastVote, useVotes } from './use-votes.js';

interface VoteButtonsProps {
  section: ContentType;
  itemId: string;
  preferenceVersion: number;
}

export function VoteButtons({ section, itemId, preferenceVersion }: VoteButtonsProps) {
  const votesQuery = useVotes();
  const castVoteMutation = useCastVote();
  const currentValue = findVoteValue(votesQuery.data, section, itemId);

  function handleVote(value: 1 | -1): void {
    castVoteMutation.mutate({
      section,
      itemId,
      preferenceVersion,
      // Pressing the direction already active clears the vote, which is what
      // the request schema's third literal exists for.
      value: currentValue === value ? 0 : value,
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <VoteButton
        direction="up"
        isActive={currentValue === 1}
        onPress={() => {
          handleVote(1);
        }}
      />
      <VoteButton
        direction="down"
        isActive={currentValue === -1}
        onPress={() => {
          handleVote(-1);
        }}
      />
    </div>
  );
}
