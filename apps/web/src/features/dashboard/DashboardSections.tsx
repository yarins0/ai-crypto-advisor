import type { DashboardResponse } from '@aca/shared';

import { InsightCard } from './InsightCard.js';
import { MemeCard } from './MemeCard.js';
import { NewsCard } from './NewsCard.js';
import { PricesCard } from './PricesCard.js';

interface DashboardSectionsProps {
  dashboard: DashboardResponse;
}

/**
 * A null section is one the user did not select, so it renders nothing at all.
 * All four keys are always present on the wire precisely so that "absent" and
 * "deselected" cannot be confused here.
 *
 * News leads because the grid is a CSS multi-column, which fills greedily in DOM
 * order: a card taller than the balance target is pushed whole into the second
 * column and strands every card after it. The tallest section has to go first.
 *
 * Returns a fragment: the caller owns the grid, so the placeholder shown while
 * loading and these cards share one layout definition.
 */
export function DashboardSections({ dashboard }: DashboardSectionsProps) {
  const { sections, preferenceVersion } = dashboard;

  return (
    <>
      {sections.news === null ? null : (
        <NewsCard section={sections.news} preferenceVersion={preferenceVersion} />
      )}
      {sections.prices === null ? null : (
        <PricesCard section={sections.prices} preferenceVersion={preferenceVersion} />
      )}
      {sections.insight === null ? null : (
        <InsightCard section={sections.insight} preferenceVersion={preferenceVersion} />
      )}
      {sections.memes === null ? null : (
        <MemeCard section={sections.memes} preferenceVersion={preferenceVersion} />
      )}
    </>
  );
}
