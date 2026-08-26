import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import type { ContentSource } from '@aca/shared';

/**
 * Deliberately far past any caller's TTL. The stale tier below serves rows that
 * have already expired, so a reaper tied to freshness would delete exactly what
 * that tier exists to return.
 */
const PURGE_AFTER_SECONDS = 7 * 24 * 60 * 60;

export interface ContentCacheAttributes {
  key: string;
  payload: unknown;
  fetchedAt: Date;
}

export type ContentCacheDocument = HydratedDocument<ContentCacheAttributes>;

// No `timestamps: true`: createdAt and updatedAt would both restate fetchedAt.
const contentCacheSchema = new Schema<ContentCacheAttributes>({
  key: { type: String, required: true, unique: true, index: true },
  payload: { type: Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, required: true },
});

// Changing this horizon later needs the index dropped by hand first — MongoDB
// rejects a redefinition with different options, and model.init() surfaces that
// as a boot failure.
contentCacheSchema.index({ fetchedAt: 1 }, { expires: PURGE_AFTER_SECONDS });

export const ContentCacheModel = mongoose.model<ContentCacheAttributes>(
  'ContentCache',
  contentCacheSchema,
);

export interface CachedContent<T> {
  data: T;
  source: ContentSource;
  fetchedAt: Date;
}

interface CachedContentOptions<T> {
  /** Include a version segment (`coingecko:v1:markets`); see getCachedContent. */
  key: string;
  ttlSeconds: number;
  fetcher: () => Promise<T>;
  fallback: () => T;
}

/**
 * A write failure must not fail a request whose data was already fetched
 * successfully — an upsert can still collide on the unique key under
 * concurrency.
 */
async function writeCacheEntry(key: string, payload: unknown, fetchedAt: Date): Promise<void> {
  try {
    await ContentCacheModel.updateOne({ key }, { $set: { payload, fetchedAt } }, { upsert: true });
  } catch (error) {
    console.warn(`Could not write cache entry ${key}:`, error);
  }
}

/**
 * Runs the three-tier degradation path from PLAN.md §6: live fetch, then stale
 * cache, then committed fallback. Options are named rather than positional
 * because `fetcher` and `fallback` are both nullary callables, so a positional
 * swap would typecheck and silently promote canned data to the primary source.
 *
 * Callers must version their key. A deploy that changes a payload's shape bumps
 * the version instead of migrating rows, which is what makes the cast below
 * sound: a row written under `:v1` is never read by code expecting `:v2`.
 */
export async function getCachedContent<T>({
  key,
  ttlSeconds,
  fetcher,
  fallback,
}: CachedContentOptions<T>): Promise<CachedContent<T>> {
  // Read once, before the fetch attempt, because the stale tier needs this row
  // even when the fetch was expected to miss.
  const cached = await ContentCacheModel.findOne({ key });

  if (cached !== null && Date.now() - cached.fetchedAt.getTime() < ttlSeconds * 1000) {
    return { data: cached.payload as T, source: 'live', fetchedAt: cached.fetchedAt };
  }

  // No stampede lock. Concurrent misses cost a few redundant upstream calls, and
  // the worst outcome — a rate limit — is what the tiers below already absorb. If
  // one instance ever serves enough traffic to matter, coalesce in process with a
  // Map<key, Promise<T>>; a distributed lock would be worse than the problem.
  try {
    const data = await fetcher();
    const fetchedAt = new Date();
    await writeCacheEntry(key, data, fetchedAt);
    return { data, source: 'live', fetchedAt };
  } catch (error) {
    console.warn(`Upstream refresh failed for ${key}:`, error);
  }

  // Carries the row's original timestamp, never now, so the UI can report how
  // stale the data actually is.
  if (cached !== null) {
    return { data: cached.payload as T, source: 'cache', fetchedAt: cached.fetchedAt };
  }

  // Dated now rather than at authoring time: a committed date would render as
  // months old, which reads as broken rather than degraded.
  return { data: fallback(), source: 'fallback', fetchedAt: new Date() };
}
