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
 */
export function DashboardSections({ dashboard }: DashboardSectionsProps) {
  const { sections, preferenceVersion } = dashboard;

  return (
    <div className="flex flex-col gap-4">
      {sections.prices === null ? null : (
        <PricesCard section={sections.prices} preferenceVersion={preferenceVersion} />
      )}
      {sections.insight === null ? null : (
        <InsightCard section={sections.insight} preferenceVersion={preferenceVersion} />
      )}
      {sections.news === null ? null : (
        <NewsCard section={sections.news} preferenceVersion={preferenceVersion} />
      )}
      {sections.memes === null ? null : (
        <MemeCard section={sections.memes} preferenceVersion={preferenceVersion} />
      )}
    </div>
  );
}
