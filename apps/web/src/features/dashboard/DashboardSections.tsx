import { useState, type ReactNode } from 'react';

import type { ContentType, DashboardResponse } from '@aca/shared';

import { InsightCard } from './InsightCard.js';
import { MasonryColumns } from './MasonryColumns.js';
import { MemeCard } from './MemeCard.js';
import { NewsCard } from './NewsCard.js';
import { PricesCard } from './PricesCard.js';
import { reorderSections } from './reorder-sections.js';

interface DashboardSectionsProps {
  dashboard: DashboardResponse;
  order: ContentType[];
  onReorder: (order: ContentType[]) => void;
}

const SECTION_LABELS: Record<ContentType, string> = {
  news: 'News',
  prices: 'Prices',
  insight: 'Insight of the day',
  memes: 'Meme',
};

function renderSection(
  contentType: ContentType,
  dashboard: DashboardResponse,
  dragHandle: ReactNode,
) {
  const { sections, preferenceVersion } = dashboard;

  switch (contentType) {
    case 'news':
      return sections.news === null ? null : (
        <NewsCard
          section={sections.news}
          preferenceVersion={preferenceVersion}
          dragHandle={dragHandle}
        />
      );
    case 'prices':
      return sections.prices === null ? null : (
        <PricesCard
          section={sections.prices}
          preferenceVersion={preferenceVersion}
          dragHandle={dragHandle}
        />
      );
    case 'insight':
      return sections.insight === null ? null : (
        <InsightCard
          section={sections.insight}
          preferenceVersion={preferenceVersion}
          dragHandle={dragHandle}
        />
      );
    case 'memes':
      return sections.memes === null ? null : (
        <MemeCard
          section={sections.memes}
          preferenceVersion={preferenceVersion}
          dragHandle={dragHandle}
        />
      );
  }
}

/**
 * A null section is one the user did not select, so it renders nothing at all.
 * All four keys are always present on the wire precisely so that "absent" and
 * "deselected" cannot be confused here.
 *
 * `order` defaults to the shared `contentTypes` vocabulary and otherwise comes
 * straight from drag-and-drop. Deselected sections are dropped with flatMap
 * before reaching MasonryColumns, so a null slot never consumes a column
 * position.
 */
export function DashboardSections({ dashboard, order, onReorder }: DashboardSectionsProps) {
  const [draggedType, setDraggedType] = useState<ContentType | null>(null);

  const items = order.flatMap((contentType) => {
    // Sits inside the card's own header (passed through as a prop) rather
    // than wrapping the card, so drag-start comes from a small handle, not
    // the whole card surface, and inner links/buttons stay clickable.
    const dragHandle = (
      <button
        type="button"
        draggable
        onDragStart={() => setDraggedType(contentType)}
        onDragEnd={() => setDraggedType(null)}
        aria-label={`Reorder ${SECTION_LABELS[contentType]} section`}
        className="cursor-grab select-none font-mono text-sm text-ink-faint hover:text-ink active:cursor-grabbing"
      >
        ⠿
      </button>
    );

    const content = renderSection(contentType, dashboard, dragHandle);
    if (content === null) return [];

    return [
      <div
        key={contentType}
        className={draggedType === contentType ? 'opacity-40' : undefined}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (draggedType !== null && draggedType !== contentType) {
            onReorder(reorderSections(order, draggedType, contentType));
          }
          setDraggedType(null);
        }}
      >
        {content}
      </div>,
    ];
  });

  return <MasonryColumns items={items} />;
}
