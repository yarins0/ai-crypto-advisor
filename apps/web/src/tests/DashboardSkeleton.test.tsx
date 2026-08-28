import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardSkeleton } from '../features/dashboard/DashboardSkeleton.js';

/** Each card is aria-hidden and holds its row bars in its last child element. */
function renderedRowCounts(container: HTMLElement): number[] {
  return [...container.querySelectorAll('[aria-hidden="true"]')].map(
    (card) => card.lastElementChild?.childElementCount ?? 0,
  );
}

describe('DashboardSkeleton', () => {
  it('draws nothing until the selection is known, rather than guessing at four cards', () => {
    const { container } = render(<DashboardSkeleton selectedSections={undefined} />);

    expect(renderedRowCounts(container)).toEqual([]);
  });

  // The real cards render in the shared contentTypes order, so a placeholder in
  // any other order re-packs the columns when it is replaced.
  it('draws one card per selected section, in the order the real cards use', () => {
    const { container } = render(<DashboardSkeleton selectedSections={['memes', 'news']} />);

    expect(renderedRowCounts(container)).toEqual([4, 1]);
  });
});
