import type { InsightSection } from '@aca/shared';

import { Card } from '../../components/Card.js';
import { VoteButtons } from '../votes/VoteButtons.js';

interface InsightCardProps {
  section: InsightSection;
  preferenceVersion: number;
}

export function InsightCard({ section, preferenceVersion }: InsightCardProps) {
  // A null model means the deterministic template produced this, not an LLM.
  // Saying so is the honest version of a section that can silently degrade.
  const attribution =
    section.data.model === null ? 'Built from today’s market data' : section.data.model;

  return (
    <Card title="Insight of the day" source={section.source} fetchedAt={section.fetchedAt}>
      <p className="text-sm leading-relaxed text-ink">{section.data.text}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-ink-faint">{attribution}</p>
        <VoteButtons
          section="insight"
          itemId={section.data.id}
          preferenceVersion={preferenceVersion}
        />
      </div>
    </Card>
  );
}
