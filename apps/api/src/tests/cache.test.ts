import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContentCacheModel, getCachedContent } from '../lib/cache.js';

interface Payload {
  value: string;
}

const TTL_SECONDS = 1;
const STALE_MS = 10_000;

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceConsoleWarn(): void {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
}

async function insertRow(key: string, payload: Payload, fetchedAt: Date): Promise<void> {
  await ContentCacheModel.create({ key, payload, fetchedAt });
}

describe('getCachedContent', () => {
  it('serves a fresh row without calling the fetcher', async () => {
    const fetchedAt = new Date();
    await insertRow('fresh-key', { value: 'stored' }, fetchedAt);
    const fetcher = vi.fn<() => Promise<Payload>>();
    const fallback = vi.fn<() => Payload>();

    const result = await getCachedContent({
      key: 'fresh-key',
      ttlSeconds: 60,
      fetcher,
      fallback,
    });

    expect(result).toEqual({ data: { value: 'stored' }, source: 'live', fetchedAt });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fetches and writes a row when none exists', async () => {
    const fetcher = vi.fn<() => Promise<Payload>>().mockResolvedValue({ value: 'fresh' });
    const fallback = vi.fn<() => Payload>();
    const before = Date.now();

    const result = await getCachedContent({
      key: 'new-key',
      ttlSeconds: TTL_SECONDS,
      fetcher,
      fallback,
    });

    expect(result.source).toBe('live');
    expect(result.data).toEqual({ value: 'fresh' });
    expect(result.fetchedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.fetchedAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(fallback).not.toHaveBeenCalled();

    const rows = await ContentCacheModel.find({ key: 'new-key' });
    expect(rows).toHaveLength(1);
  });

  it('refetches a stale row on success and updates the existing row rather than inserting a second one', async () => {
    const originalFetchedAt = new Date(Date.now() - STALE_MS);
    await insertRow('stale-key', { value: 'old' }, originalFetchedAt);
    const fetcher = vi.fn<() => Promise<Payload>>().mockResolvedValue({ value: 'new' });
    const fallback = vi.fn<() => Payload>();

    const result = await getCachedContent({
      key: 'stale-key',
      ttlSeconds: TTL_SECONDS,
      fetcher,
      fallback,
    });

    expect(result.source).toBe('live');
    expect(result.data).toEqual({ value: 'new' });
    expect(result.fetchedAt.getTime()).toBeGreaterThan(originalFetchedAt.getTime());

    const rows = await ContentCacheModel.find({ key: 'stale-key' });
    expect(rows).toHaveLength(1);
  });

  it('falls back to the stale row with its original fetchedAt when the fetcher throws', async () => {
    silenceConsoleWarn();
    const originalFetchedAt = new Date(Date.now() - STALE_MS);
    await insertRow('degraded-key', { value: 'stale-payload' }, originalFetchedAt);
    const fetcher = vi.fn<() => Promise<Payload>>().mockRejectedValue(new Error('upstream down'));
    const fallback = vi.fn<() => Payload>();

    const result = await getCachedContent({
      key: 'degraded-key',
      ttlSeconds: TTL_SECONDS,
      fetcher,
      fallback,
    });

    expect(result.source).toBe('cache');
    expect(result.data).toEqual({ value: 'stale-payload' });
    // The row's ORIGINAL timestamp, not the moment of this failed refresh —
    // this is what actually distinguishes "stale" data from "just fetched" data.
    expect(result.fetchedAt.getTime()).toBe(originalFetchedAt.getTime());
    expect(fallback).not.toHaveBeenCalled();
  });

  it('serves the fallback when the fetcher throws and no row exists', async () => {
    silenceConsoleWarn();
    const fetcher = vi.fn<() => Promise<Payload>>().mockRejectedValue(new Error('upstream down'));
    const fallback = vi.fn<() => Payload>().mockReturnValue({ value: 'fallback-payload' });
    const before = Date.now();

    const result = await getCachedContent({
      key: 'missing-key',
      ttlSeconds: TTL_SECONDS,
      fetcher,
      fallback,
    });

    expect(result.source).toBe('fallback');
    expect(result.data).toEqual({ value: 'fallback-payload' });
    expect(result.fetchedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.fetchedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('defines a TTL index on fetchedAt', async () => {
    const indexes = await ContentCacheModel.collection.listIndexes().toArray();
    const ttlIndex = indexes.find(
      (index) => index.expireAfterSeconds !== undefined && 'fetchedAt' in index.key,
    );

    expect(ttlIndex).toBeDefined();
  });
});
