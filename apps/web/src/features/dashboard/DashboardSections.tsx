import { useRef, useState, type ReactNode } from 'react';

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

const DROP_TARGET_CLASSES = ['ring-2', 'ring-accent'];

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
  // The drop-target ring is DOM-mutated directly rather than kept in React
  // state: dragover fires continuously while the pointer moves, and
  // re-rendering React on every tick risks the browser losing track of the
  // native drag if the dragged node gets reconciled underneath it mid-gesture.
  // dragenter/dragleave fire only at boundary crossings, which is infrequent
  // enough to be safe, and classList sidesteps React entirely.
  const highlightedElementRef = useRef<HTMLDivElement | null>(null);

  function clearHighlight(): void {
    highlightedElementRef.current?.classList.remove(...DROP_TARGET_CLASSES);
    highlightedElementRef.current = null;
  }

  function endDrag(): void {
    setDraggedType(null);
    clearHighlight();
  }

  const items = order.flatMap((contentType) => {
    // Sits inside the card's own header (passed through as a prop) rather
    // than wrapping the card, so drag-start comes from a small handle, not
    // the whole card surface, and inner links/buttons stay clickable.
    const dragHandle = (
      <button
        type="button"
        draggable
        onDragStart={() => setDraggedType(contentType)}
        onDragEnd={endDrag}
        aria-label={`Reorder ${SECTION_LABELS[contentType]} section`}
        className="cursor-grab select-none font-mono text-sm text-ink-faint hover:text-ink active:cursor-grabbing"
      >
        ⠿
      </button>
    );

    const content = renderSection(contentType, dashboard, dragHandle);
    if (content === null) return [];

    const isDragged = draggedType === contentType;

    return [
      <div
        key={contentType}
        className={`rounded-xl transition-shadow duration-150 ${isDragged ? 'opacity-40 shadow-2xl' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={(event) => {
          if (isDragged) return;
          // A stray element can be left highlighted if dragleave never fired
          // for it (a very fast pointer can skip the event); clearing before
          // marking the new one keeps at most one ring lit at a time.
          clearHighlight();
          event.currentTarget.classList.add(...DROP_TARGET_CLASSES);
          highlightedElementRef.current = event.currentTarget;
        }}
        onDragLeave={(event) => {
          // dragenter/dragleave fire at every nested element boundary a card's
          // own content crosses, not just the card's outer edge; ignoring a
          // leave into a still-contained child is what stops the ring from
          // flickering as the pointer moves across the card's insides.
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          event.currentTarget.classList.remove(...DROP_TARGET_CLASSES);
          if (highlightedElementRef.current === event.currentTarget) {
            highlightedElementRef.current = null;
          }
        }}
        onDrop={() => {
          if (draggedType !== null && draggedType !== contentType) {
            onReorder(reorderSections(order, draggedType, contentType));
          }
          endDrag();
        }}
      >
        {content}
      </div>,
    ];
  });

  return <MasonryColumns items={items} />;
}
