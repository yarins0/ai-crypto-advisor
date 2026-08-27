type VoteDirection = 'up' | 'down';

interface VoteButtonProps {
  direction: VoteDirection;
  isActive: boolean;
  onPress: () => void;
}

const DIRECTION_LABEL: Record<VoteDirection, string> = { up: 'Upvote', down: 'Downvote' };
const DIRECTION_GLYPH: Record<VoteDirection, string> = { up: '▲', down: '▼' };
const ACTIVE_CLASS: Record<VoteDirection, string> = {
  up: 'border-up text-up',
  down: 'border-down text-down',
};

export function VoteButton({ direction, isActive, onPress }: VoteButtonProps) {
  const stateClass = isActive ? ACTIVE_CLASS[direction] : 'border-slate-800 text-slate-500';

  return (
    <button
      type="button"
      // The glyph carries no accessible name of its own, and aria-pressed is
      // what conveys that this is a toggle rather than a one-way action.
      aria-label={DIRECTION_LABEL[direction]}
      aria-pressed={isActive}
      onClick={onPress}
      className={`flex size-11 shrink-0 items-center justify-center rounded-lg border text-xs ${stateClass}`}
    >
      {DIRECTION_GLYPH[direction]}
    </button>
  );
}
