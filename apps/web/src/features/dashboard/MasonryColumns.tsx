import type { ReactNode } from 'react';

import { useMediaQuery } from '../../lib/use-media-query.js';

const TWO_COLUMN_QUERY = '(min-width: 64rem)';

interface MasonryColumnsProps {
  items: ReactNode[];
}

/**
 * Splits items into two independently-stacking columns by position parity
 * (0, 2, 4… left; 1, 3, 5… right) rather than a CSS grid row, so a short card
 * never leaves dead space below it for a taller neighbour in the same row to
 * fill — each column just packs tightly on its own. This is also what makes
 * drag position predictable: a card's column is a pure function of its index
 * in `items`, not a browser height-balancing heuristic that shifts under
 * reordering.
 *
 * Below `lg` this collapses to one column matching the page's true order
 * (interleaving both columns would read out of sequence on a phone).
 *
 * The shared home for both the skeleton and the real cards, so the two
 * cannot end up laid out differently — the whole point of a placeholder.
 */
export function MasonryColumns({ items }: MasonryColumnsProps) {
  const isTwoColumn = useMediaQuery(TWO_COLUMN_QUERY);

  if (!isTwoColumn) {
    return <div className="card-stagger flex flex-col gap-4">{items}</div>;
  }

  if (items.length === 1) {
    // Half the width, centred: the alternative — letting a lone card stretch
    // to the full row now that nothing constrains it — is the visual jump
    // this exists to avoid.
    return <div className="mx-auto flex max-w-[calc(50%-0.5rem)] flex-col">{items}</div>;
  }

  const leftColumn = items.filter((_, index) => index % 2 === 0);
  const rightColumn = items.filter((_, index) => index % 2 === 1);

  return (
    <div className="flex gap-4">
      <div className="card-stagger flex flex-1 flex-col gap-4">{leftColumn}</div>
      <div className="card-stagger flex flex-1 flex-col gap-4">{rightColumn}</div>
    </div>
  );
}
