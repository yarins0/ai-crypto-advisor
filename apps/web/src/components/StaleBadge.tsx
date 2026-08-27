import type { ContentSource } from '@aca/shared';

import { formatRelativeTime } from '../lib/format.js';

interface StaleBadgeProps {
  source: ContentSource;
  fetchedAt: string;
}

/**
 * Renders nothing for live data, and a cache hit inside its TTL reports as live,
 * so this stays dark on a healthy render rather than lighting on every one.
 */
export function StaleBadge({ source, fetchedAt }: StaleBadgeProps) {
  if (source === 'live') {
    return null;
  }

  // 'cache' is real data that has gone stale, so it is dated honestly.
  // 'fallback' is committed sample content, where a timestamp would mislead.
  const label = source === 'cache' ? `Updated ${formatRelativeTime(fetchedAt)}` : 'Saved copy';

  return (
    <span className="rounded-full border border-amber-900/60 bg-amber-950/40 px-2 py-0.5 text-xs text-amber-200">
      {label}
    </span>
  );
}
