import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { dashboardResponseSchema } from '@aca/shared';
import type { AssetId, ContentType, DashboardResponse } from '@aca/shared';

import { env } from '../env.js';
import { fetchNewsForAsset, toTagSlug } from '../integrations/cointelegraph.js';
import { chatCompletion } from '../integrations/huggingface.js';
import { ContentCacheModel } from '../lib/cache.js';
import { PreferenceModel } from '../modules/preferences/model.js';
import { createApp } from '../app.js';

// env.ts parses process.env once, at import time, into a frozen module-level
// object — no HF_TOKEN is configured in the test run, so
// stubbing process.env later can never reach chatCompletion's own env check.
// Mocking the client itself is the only way to exercise both the AI-success
// and AI-failure paths deterministically.
vi.mock('../integrations/huggingface.js', () => ({ chatCompletion: vi.fn() }));

const mockChatCompletion = vi.mocked(chatCompletion);

const VALID_PASSWORD = 'Sup3rSecret!';
const app = createApp();

function uniqueEmail(): string {
  return `user-${randomUUID()}@example.com`;
}

interface UpstreamCoinOverrides {
  id?: string;
  symbol?: string;
  name?: string;
  current_price?: number;
  price_change_percentage_24h?: number;
}

function buildUpstreamCoin(overrides: UpstreamCoinOverrides = {}): Record<string, unknown> {
  return {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    current_price: 80_000,
    market_cap: 1_500_000_000_000,
    price_change_percentage_24h: -1.5,
    sparkline_in_7d: { price: [79_000, 79_500, 80_000] },
    ...overrides,
  };
}

function buildFeed(itemsXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>Cointelegraph.com News</title>
${itemsXml}
</channel></rss>`;
}

function buildItemXml(guid: string, pubDate: string, title = guid): string {
  return `<item><title>${title}</title><pubDate>${pubDate}</pubDate><guid isPermaLink="true">${guid}</guid><link><![CDATA[https://cointelegraph.com/news/${guid}]]></link></item>`;
}

interface UpstreamMockOptions {
  coins?: Record<string, unknown>[];
  newsItemsByAssetId?: Partial<Record<AssetId, string>>;
}

// Routes a single fetch spy to the right canned response by inspecting the
// URL, the same boundary coingecko.test.ts and cointelegraph.test.ts stub
// individually — combined here because one dashboard build calls both.
function mockUpstreamFetch(options: UpstreamMockOptions = {}): void {
  const coins = options.coins ?? [buildUpstreamCoin()];
  const newsItemsByAssetId = options.newsItemsByAssetId ?? {};

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('api.coingecko.com')) {
      return new Response(JSON.stringify(coins), { status: 200 });
    }
    if (url.includes('cointelegraph.com/rss/tag/')) {
      const slug = url.split('/rss/tag/')[1] ?? '';
      const assetId = (Object.keys(newsItemsByAssetId) as AssetId[]).find(
        (id) => toTagSlug(id) === slug,
      );
      const itemsXml = assetId ? (newsItemsByAssetId[assetId] ?? '') : '';
      return new Response(buildFeed(itemsXml), { status: 200 });
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

interface PreferencesOverrides {
  assets?: AssetId[];
  contentTypes?: ContentType[];
}

async function registerAndOnboard(
  overrides: PreferencesOverrides = {},
): Promise<{ accessToken: string; userId: string }> {
  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send({ email: uniqueEmail(), name: 'Test User', password: VALID_PASSWORD });
  const accessToken = (registerResponse.body as { accessToken: string }).accessToken;

  await request(app)
    .put('/api/preferences')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      assets: overrides.assets ?? ['bitcoin'],
      investorType: 'hodler',
      contentTypes: overrides.contentTypes ?? ['news', 'prices', 'insight', 'memes'],
      riskTolerance: 'medium',
    });

  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
  return { accessToken, userId: (me.body as { id: string }).id };
}

afterEach(() => {
  // fileParallelism is disabled, so every test file shares one worker; a
  // leaked fetch/Math.random stub here would poison tests run after this one.
  vi.restoreAllMocks();
});

function silenceConsoleWarn(): void {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
}

describe('GET /api/dashboard', () => {
  it('rejects a non-onboarded user with 403', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), name: 'Test User', password: VALID_PASSWORD });
    const accessToken = (registerResponse.body as { accessToken: string }).accessToken;

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  it('returns a body that validates against dashboardResponseSchema', async () => {
    mockUpstreamFetch();
    const { accessToken } = await registerAndOnboard();

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(() => dashboardResponseSchema.parse(response.body)).not.toThrow();
  });

  it("includes a top-level preferenceVersion matching the caller's current Preference.version", async () => {
    mockUpstreamFetch();
    const { accessToken, userId } = await registerAndOnboard();
    const preference = await PreferenceModel.findOne({ userId });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const body = response.body as DashboardResponse;

    expect(body.preferenceVersion).toBe(preference?.version);
  });

  it('always includes all four section keys, null for a section not selected', async () => {
    mockUpstreamFetch();
    const { accessToken } = await registerAndOnboard({ contentTypes: ['news'] });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const body = response.body as DashboardResponse;

    // Both assertions matter: an accidentally dropped key would still pass a
    // `=== null` check via optional chaining, and a merely-empty section
    // would still pass an `in` check.
    expect('prices' in body.sections).toBe(true);
    expect(body.sections.prices).toBeNull();
    expect('insight' in body.sections).toBe(true);
    expect(body.sections.insight).toBeNull();
    expect('memes' in body.sections).toBe(true);
    expect(body.sections.memes).toBeNull();
    expect(body.sections.news).not.toBeNull();
  });

  it('reports a selected section with data, a valid source, and a parseable fetchedAt', async () => {
    mockUpstreamFetch({ coins: [buildUpstreamCoin()] });
    const { accessToken } = await registerAndOnboard({ contentTypes: ['prices'] });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const prices = (response.body as DashboardResponse).sections.prices;

    expect(prices).not.toBeNull();
    expect(['live', 'cache', 'fallback']).toContain(prices?.source);
    expect(Number.isNaN(Date.parse(prices?.fetchedAt ?? ''))).toBe(false);
  });

  it('filters prices to the assets the user selected', async () => {
    mockUpstreamFetch({
      coins: [
        buildUpstreamCoin({ id: 'bitcoin' }),
        buildUpstreamCoin({ id: 'ethereum', symbol: 'eth', name: 'Ethereum' }),
      ],
    });
    const { accessToken } = await registerAndOnboard({
      assets: ['bitcoin'],
      contentTypes: ['prices'],
    });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const coinIds = ((response.body as DashboardResponse).sections.prices?.data ?? []).map(
      (coin) => coin.id,
    );

    expect(coinIds).toEqual(['bitcoin']);
  });

  it('gates prices on the prices content type even though insight also needs coin markets', async () => {
    mockUpstreamFetch();
    mockChatCompletion.mockRejectedValueOnce(new Error('HF down'));
    const { accessToken } = await registerAndOnboard({ contentTypes: ['insight'] });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const body = response.body as DashboardResponse;

    expect(body.sections.prices).toBeNull();
    expect(body.sections.insight).not.toBeNull();
  });

  it('merges and dedupes news across assets, sorted by publishedAt descending', async () => {
    mockUpstreamFetch({
      newsItemsByAssetId: {
        bitcoin: [
          buildItemXml('shared-1', 'Wed, 26 Aug 2026 12:00:00 +0000'),
          buildItemXml('btc-only', 'Wed, 26 Aug 2026 14:00:00 +0000'),
        ].join(''),
        ethereum: [buildItemXml('shared-1', 'Wed, 26 Aug 2026 12:00:00 +0000')].join(''),
      },
    });
    const { accessToken } = await registerAndOnboard({
      assets: ['bitcoin', 'ethereum'],
      contentTypes: ['news'],
    });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const news = (response.body as DashboardResponse).sections.news;

    expect(news?.data.map((item) => item.id)).toEqual(['btc-only', 'shared-1']);
  });

  it('caps merged news at 12 items', async () => {
    const items = Array.from({ length: 15 }, (_, index) =>
      buildItemXml(
        `article-${index}`,
        `Wed, 26 Aug 2026 ${String(index).padStart(2, '0')}:00:00 +0000`,
      ),
    ).join('');
    mockUpstreamFetch({ newsItemsByAssetId: { bitcoin: items } });
    const { accessToken } = await registerAndOnboard({
      assets: ['bitcoin'],
      contentTypes: ['news'],
    });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const news = (response.body as DashboardResponse).sections.news;

    expect(news?.data).toHaveLength(12);
  });

  it('falls back with non-empty curated data when every news feed returns zero items', async () => {
    mockUpstreamFetch({ newsItemsByAssetId: { bitcoin: '' } });
    const { accessToken } = await registerAndOnboard({
      assets: ['bitcoin'],
      contentTypes: ['news'],
    });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const news = (response.body as DashboardResponse).sections.news;

    expect(news?.source).toBe('fallback');
    expect(news?.data.length).toBeGreaterThan(0);
  });

  it('reports the worst tier and oldest fetchedAt among the contributing news feeds', async () => {
    silenceConsoleWarn();
    const { accessToken } = await registerAndOnboard({
      assets: ['bitcoin', 'ethereum'],
      contentTypes: ['news'],
    });

    // Seed ethereum's news cache row via one real successful fetch, then
    // backdate that row directly rather than hardcoding the module's private
    // cache-key format. The dashboard's own request for ethereum is then made
    // to fail, so getCachedContent serves this now-stale row from the 'cache'
    // tier — giving a deterministic, older fetchedAt to assert against
    // without racing two concurrent fetches against the wall clock.
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(buildFeed(buildItemXml('eth-old', 'Wed, 26 Aug 2026 10:00:00 +0000')), {
        status: 200,
      }),
    );
    await fetchNewsForAsset('ethereum');
    const staleFetchedAt = new Date(Date.now() - 3_700_000);
    await ContentCacheModel.updateOne({}, { $set: { fetchedAt: staleFetchedAt } });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/rss/tag/ethereum')) {
        return new Response('server error', { status: 500 });
      }
      if (url.includes('/rss/tag/bitcoin')) {
        return new Response(
          buildFeed(buildItemXml('btc-fresh', 'Wed, 26 Aug 2026 14:00:00 +0000')),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const news = (response.body as DashboardResponse).sections.news;

    expect(news?.source).toBe('cache');
    expect(new Date(news?.fetchedAt ?? '').getTime()).toBe(staleFetchedAt.getTime());
  });
});

describe('AI insight', () => {
  it('uses the configured model id and the upstream reply when the chat call succeeds', async () => {
    mockUpstreamFetch();
    mockChatCompletion.mockResolvedValueOnce('Buy the dip, responsibly.');
    const { accessToken } = await registerAndOnboard({ contentTypes: ['insight'] });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const insight = (response.body as DashboardResponse).sections.insight;

    expect(insight?.data.model).toBe(env.HF_MODEL);
    expect(insight?.data.text).toBe('Buy the dip, responsibly.');
    expect(insight?.source).toBe('live');
  });

  it('falls back to a templated insight when the chat call fails', async () => {
    silenceConsoleWarn();
    mockUpstreamFetch();
    mockChatCompletion.mockRejectedValueOnce(new Error('HF down'));
    const { accessToken } = await registerAndOnboard({ contentTypes: ['insight'] });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const insight = (response.body as DashboardResponse).sections.insight;

    expect(insight?.data.model).toBeNull();
    expect(insight?.data.text.length).toBeGreaterThan(0);
    expect(insight?.source).toBe('fallback');
  });

  it('builds the fallback text entirely from the real coin fixtures', async () => {
    silenceConsoleWarn();
    mockUpstreamFetch({
      coins: [
        buildUpstreamCoin({ id: 'bitcoin', name: 'Bitcoin', price_change_percentage_24h: -1.5 }),
        buildUpstreamCoin({
          id: 'ethereum',
          symbol: 'eth',
          name: 'Ethereum',
          price_change_percentage_24h: 2.3,
        }),
      ],
    });
    mockChatCompletion.mockRejectedValueOnce(new Error('HF down'));
    const { accessToken } = await registerAndOnboard({
      assets: ['bitcoin', 'ethereum'],
      contentTypes: ['insight'],
    });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const text = (response.body as DashboardResponse).sections.insight?.data.text ?? '';

    expect(text).toContain('Ethereum led your watchlist at 2.30%');
    expect(text).toContain('Bitcoin lagged at -1.50%');
  });

  // With a single tracked asset, findPerformers sets both `best` and `worst`
  // to that same coin; the fallback text has a dedicated branch for this so
  // it does not read as a bug ("X led... while X lagged...").
  it('names a single tracked asset only once, not as both best and worst performer', async () => {
    silenceConsoleWarn();
    mockUpstreamFetch({
      coins: [
        buildUpstreamCoin({ id: 'bitcoin', name: 'Bitcoin', price_change_percentage_24h: -1.5 }),
      ],
    });
    mockChatCompletion.mockRejectedValueOnce(new Error('HF down'));
    const { accessToken } = await registerAndOnboard({
      assets: ['bitcoin'],
      contentTypes: ['insight'],
    });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const text = (response.body as DashboardResponse).sections.insight?.data.text ?? '';

    expect(text.match(/Bitcoin/g)).toHaveLength(1);
  });

  // Markdown is a formatting mistake with no truth content, so the reply is
  // repaired and still served live — the opposite of the rejection below.
  it('strips Markdown syntax from a live reply instead of rejecting it', async () => {
    mockUpstreamFetch();
    mockChatCompletion.mockResolvedValueOnce('**Daily Insight**\n\nBitcoin _cooled_ 1.50% today.');
    const { accessToken } = await registerAndOnboard({ contentTypes: ['insight'] });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const insight = (response.body as DashboardResponse).sections.insight;

    expect(insight?.source).toBe('live');
    expect(insight?.data.text).toBe('Daily Insight\n\nBitcoin cooled 1.50% today.');
  });

  it('rejects a live reply quoting a dollar figure and degrades to the fallback', async () => {
    silenceConsoleWarn();
    mockUpstreamFetch();
    mockChatCompletion.mockResolvedValueOnce('Set a stop-loss at $95 and a target at $110.');
    const { accessToken } = await registerAndOnboard({ contentTypes: ['insight'] });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const insight = (response.body as DashboardResponse).sections.insight;

    expect(insight?.source).toBe('fallback');
    expect(insight?.data.model).toBeNull();
    expect(insight?.data.text).not.toContain('$');
  });

  // The other half of the same rule: rejecting every dollar figure is only
  // coherent because none is ever supplied, so none can be legitimate.
  it('sends no dollar figure to the model in the first place', async () => {
    mockUpstreamFetch();
    mockChatCompletion.mockResolvedValueOnce('Bitcoin cooled 1.50% today.');
    const { accessToken } = await registerAndOnboard({ contentTypes: ['insight'] });

    await request(app).get('/api/dashboard').set('Authorization', `Bearer ${accessToken}`);
    const prompt = (mockChatCompletion.mock.lastCall?.[0] ?? [])
      .map((message) => message.content)
      .join('\n');

    expect(prompt).not.toContain('$');
  });

  it("keys the insight's id on today's UTC calendar day", async () => {
    silenceConsoleWarn();
    mockUpstreamFetch();
    mockChatCompletion.mockRejectedValueOnce(new Error('HF down'));
    const { accessToken } = await registerAndOnboard({ contentTypes: ['insight'] });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);
    const insight = (response.body as DashboardResponse).sections.insight;

    expect(insight?.data.id).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('GET /api/dashboard/meme', () => {
  it('returns a meme envelope', async () => {
    const { accessToken } = await registerAndOnboard();

    const response = await request(app)
      .get('/api/dashboard/meme')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.meme).toMatchObject({ data: expect.any(Object), source: 'live' });
  });

  it('returns a different meme id when excluding a real one', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // always picks the last card, never the excluded first one
    const { accessToken } = await registerAndOnboard();

    const response = await request(app)
      .get('/api/dashboard/meme?exclude=hodl-1')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.body.meme.data.id).not.toBe('hodl-1');
  });

  it('ignores a non-string exclude query param instead of crashing', async () => {
    const { accessToken } = await registerAndOnboard();

    const response = await request(app)
      .get('/api/dashboard/meme')
      .query('exclude=a&exclude=b')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.meme).toBeDefined();
  });
});
