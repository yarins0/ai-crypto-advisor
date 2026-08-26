import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchNewsForAsset, toTagSlug } from '../integrations/cointelegraph.js';

function mockFetchOnce(xml: string, status = 200): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(xml, { status }));
}

afterEach(() => {
  // fileParallelism is disabled, so every test file shares one worker; a
  // leaked fetch stub here would poison tests in files run after this one.
  vi.restoreAllMocks();
});

function buildFeed(itemsXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>Cointelegraph.com News</title>
${itemsXml}
</channel></rss>`;
}

interface ItemOverrides {
  title?: string;
  pubDate?: string;
  guid?: string;
  link?: string;
  mediaUrl?: string;
  enclosureUrl?: string;
}

function buildItemXml(overrides: ItemOverrides = {}): string {
  const title = overrides.title ?? 'Bitcoin hits new high';
  const pubDate = overrides.pubDate ?? 'Wed, 26 Aug 2026 15:58:55 +0000';
  const guid = overrides.guid ?? 'https://cointelegraph.com/news/example';
  const link = overrides.link ?? 'https://cointelegraph.com/news/example?utm_source=rss_feed';
  const media =
    overrides.mediaUrl !== undefined
      ? `<media:content url="${overrides.mediaUrl}" width="528" medium="image"/>`
      : '';
  const enclosure =
    overrides.enclosureUrl !== undefined
      ? `<enclosure url="${overrides.enclosureUrl}" length="1" type="image/jpeg"/>`
      : '';
  return `<item><title>${title}</title><pubDate>${pubDate}</pubDate><guid isPermaLink="true">${guid}</guid><link><![CDATA[${link}]]></link>${media}${enclosure}</item>`;
}

describe('toTagSlug', () => {
  it('maps binancecoin to the bnb ticker slug', () => {
    expect(toTagSlug('binancecoin')).toBe('bnb');
  });

  it('maps avalanche-2 to the avalanche slug', () => {
    expect(toTagSlug('avalanche-2')).toBe('avalanche');
  });

  it('passes through any other asset id unchanged', () => {
    expect(toTagSlug('bitcoin')).toBe('bitcoin');
  });
});

describe('fetchNewsForAsset', () => {
  it('requests the overridden tag slug for an asset with a ticker override', async () => {
    const fetchSpy = mockFetchOnce(buildFeed(buildItemXml()));

    await fetchNewsForAsset('binancecoin');

    const [requestedUrl] = fetchSpy.mock.calls[0] ?? [];
    expect(String(requestedUrl)).toContain('/rss/tag/bnb');
  });

  it('returns an array of length 1 for a feed with exactly one item, not the channel title', async () => {
    mockFetchOnce(buildFeed(buildItemXml({ title: 'Only item' })));

    const result = await fetchNewsForAsset('bitcoin');

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.title).toBe('Only item');
  });

  it('decodes HTML entities in the title', async () => {
    mockFetchOnce(buildFeed(buildItemXml({ title: 'Bitcoin &amp; Ethereum rally' })));

    const result = await fetchNewsForAsset('bitcoin');

    expect(result.data[0]?.title).toBe('Bitcoin & Ethereum rally');
  });

  it('strips utm_* tracking params from the link', async () => {
    mockFetchOnce(
      buildFeed(
        buildItemXml({
          link: 'https://cointelegraph.com/news/x?utm_source=rss_feed&utm_medium=rss',
        }),
      ),
    );

    const result = await fetchNewsForAsset('bitcoin');

    expect(result.data[0]?.url).toBe('https://cointelegraph.com/news/x');
  });

  it('takes imageUrl from media:content when present', async () => {
    mockFetchOnce(buildFeed(buildItemXml({ mediaUrl: 'https://img.example.com/a.jpg' })));

    const result = await fetchNewsForAsset('bitcoin');

    expect(result.data[0]?.imageUrl).toBe('https://img.example.com/a.jpg');
  });

  it('falls back to enclosure when media:content is absent', async () => {
    mockFetchOnce(buildFeed(buildItemXml({ enclosureUrl: 'https://img.example.com/b.jpg' })));

    const result = await fetchNewsForAsset('bitcoin');

    expect(result.data[0]?.imageUrl).toBe('https://img.example.com/b.jpg');
  });

  it('is null when neither media:content nor enclosure is present', async () => {
    mockFetchOnce(buildFeed(buildItemXml()));

    const result = await fetchNewsForAsset('bitcoin');

    expect(result.data[0]?.imageUrl).toBeNull();
  });

  it('keeps a wholly numeric headline as a string rather than coercing it to a number', async () => {
    mockFetchOnce(buildFeed(buildItemXml({ title: '78000' })));

    const result = await fetchNewsForAsset('bitcoin');

    // 'live' is the assertion that matters: before parseTagValue: false, the
    // numeric title failed z.string() validation and degraded the whole feed.
    expect(result.source).toBe('live');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.title).toBe('78000');
    expect(typeof result.data[0]?.title).toBe('string');
  });

  it('converts an RFC-822 pubDate to an ISO 8601 string', async () => {
    mockFetchOnce(buildFeed(buildItemXml({ pubDate: 'Wed, 26 Aug 2026 15:58:55 +0000' })));

    const result = await fetchNewsForAsset('bitcoin');

    expect(result.data[0]?.publishedAt).toBe('2026-08-26T15:58:55.000Z');
  });

  it('degrades to the fallback on a 404 response', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetchOnce('not found', 404);

    const result = await fetchNewsForAsset('bitcoin');

    expect(result.source).toBe('fallback');
    expect(result.data.length).toBeGreaterThan(0);
  });
});
