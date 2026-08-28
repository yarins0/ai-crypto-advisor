import { useState } from 'react';

import { contentTypes, type ContentType } from '@aca/shared';

const STORAGE_KEY = 'aca:dashboard-section-order';

// A stored order can predate a contentTypes change (or come from another tab's
// stale copy); unknown entries are dropped and any section missing from it is
// appended rather than lost.
function readStoredOrder(): ContentType[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...contentTypes];

    const known = parsed.filter((value): value is ContentType =>
      (contentTypes as readonly string[]).includes(value),
    );
    const missing = contentTypes.filter((type) => !known.includes(type));
    return [...known, ...missing];
  } catch {
    return [...contentTypes];
  }
}

/** Section display order, drag-reorderable and persisted per browser — not synced to the account. */
export function useSectionOrder(): [ContentType[], (order: ContentType[]) => void] {
  const [order, setOrderState] = useState<ContentType[]>(readStoredOrder);

  function setOrder(nextOrder: ContentType[]): void {
    setOrderState(nextOrder);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextOrder));
    } catch {
      // Storage can be unavailable (private browsing, quota); order still holds for this tab.
    }
  }

  return [order, setOrder];
}
