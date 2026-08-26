/**
 * Which tier of the degradation path answered, not where the bytes came from.
 * A cache hit inside its TTL is `live`; `cache` means the data is stale and was
 * served anyway. Reporting every cache hit as `cache` would light the UI's
 * staleness badge on almost every render, which conveys nothing.
 */
export const contentSources = ['live', 'cache', 'fallback'] as const;

export type ContentSource = (typeof contentSources)[number];
