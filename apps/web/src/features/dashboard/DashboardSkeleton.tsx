import { contentTypes } from '@aca/shared';
import type { ContentType } from '@aca/shared';

import { CardSkeleton } from '../../components/CardSkeleton.js';
import { MasonryColumns } from './MasonryColumns.js';

/** Rows each section usually resolves to, used to size its placeholder. */
const SKELETON_ROWS_BY_SECTION: Record<ContentType, number> = {
  news: 4,
  prices: 5,
  insight: 3,
  memes: 1,
};

/**
 * Ordered by the shared `contentTypes` vocabulary because DashboardSections
 * renders in that same order. A placeholder whose count or order differs from
 * the real cards re-packs the columns the moment it is replaced, which is the
 * shift it exists to prevent.
 */
function getSkeletonRowCounts(selectedSections: readonly ContentType[]): number[] {
  return contentTypes
    .filter((section) => selectedSections.includes(section))
    .map((section) => SKELETON_ROWS_BY_SECTION[section]);
}

interface DashboardSkeletonProps {
  /** Undefined until the preferences request resolves. */
  selectedSections: readonly ContentType[] | undefined;
}

/** Goes through the same MasonryColumns as DashboardSections, so the placeholder and the real cards cannot be laid out differently. */
export function DashboardSkeleton({ selectedSections }: DashboardSkeletonProps) {
  // No cards until the selection is known: a guess draws four and then
  // collapses to as few as one, the user's minimum being a single section.
  const items =
    selectedSections === undefined
      ? []
      : getSkeletonRowCounts(selectedSections).map((rowCount, cardPosition) => (
          <CardSkeleton key={cardPosition} rowCount={rowCount} />
        ));

  return (
    <>
      {/* The cards are hidden from assistive tech, so the loading state is
          announced here once rather than by every bar. */}
      <p role="status" className="sr-only">
        Loading your dashboard…
      </p>
      <MasonryColumns items={items} />
    </>
  );
}
