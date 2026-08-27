import type { Insight } from '@aca/shared';

import { ContentCacheModel } from '../../lib/cache.js';

const INSIGHT_CACHE_KEY_PREFIX = 'insight:v1:';

export const INSIGHT_TTL_SECONDS = 24 * 60 * 60;

/** UTC so the key does not shift with the host's timezone or with DST. */
export function toUtcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Scoped to one user and one calendar day: a rate-limit defence, and literally
 * what "Insight of the Day" means. Day-scoping also puts yesterday's row out of
 * reach of the stale tier for good — deliberate, because yesterday's prose
 * about yesterday's prices is a worse answer than today's template about
 * today's.
 */
export function insightCacheKey(userId: string, day: string = toUtcDay()): string {
  return `${INSIGHT_CACHE_KEY_PREFIX}${userId}:${day}`;
}

/**
 * Enrichment for a vote's context snapshot, never a check on whether the vote
 * is legitimate: the templated fallback is served without writing a row, so an
 * absent row is a routine state rather than a forged item id.
 */
export async function findCachedInsight(
  userId: string,
  day: string = toUtcDay(),
): Promise<{ insight: Insight; fetchedAt: Date } | null> {
  const cached = await ContentCacheModel.findOne({ key: insightCacheKey(userId, day) });
  return cached === null
    ? null
    : { insight: cached.payload as Insight, fetchedAt: cached.fetchedAt };
}
