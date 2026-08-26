import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchCoinMarkets } from '../integrations/coingecko.js';

function buildUpstreamCoin(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

function mockFetchOnce(body: unknown, status = 200): ReturnType<typeof vi.spyOn> {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

afterEach(() => {
  // fileParallelism is disabled, so every test file shares one worker; a
  // leaked fetch stub here would poison tests in files run after this one.
  vi.restoreAllMocks();
});

describe('fetchCoinMarkets', () => {
  it('maps upstream snake_case fields to camelCase on a live 200', async () => {
    const upstreamCoin = buildUpstreamCoin();
    mockFetchOnce([upstreamCoin]);

    const result = await fetchCoinMarkets();

    expect(result.source).toBe('live');
    expect(result.data[0]).toEqual({
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      image: upstreamCoin.image,
      currentPrice: 80_000,
      priceChangePercentage24h: -1.5,
      marketCap: 1_500_000_000_000,
      sparkline: [79_000, 79_500, 80_000],
    });
  });

  it('requests all 15 curated assets in a single call', async () => {
    const fetchSpy = mockFetchOnce([buildUpstreamCoin()]);

    await fetchCoinMarkets();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [requestedUrl] = fetchSpy.mock.calls[0] ?? [];
    const url = new URL(String(requestedUrl));
    expect(url.searchParams.get('vs_currency')).toBe('usd');
    expect(url.searchParams.get('sparkline')).toBe('true');
    const requestedIds = url.searchParams.get('ids');
    expect(requestedIds).toContain('bitcoin');
    expect(requestedIds).toContain('ethereum');
    expect(requestedIds).toContain('avalanche-2');
  });

  it('degrades to the fallback on a 500 response', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetchOnce({}, 500);

    const result = await fetchCoinMarkets();

    expect(result.source).toBe('fallback');
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('degrades to the fallback when a mapped field has the wrong type', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetchOnce([buildUpstreamCoin({ current_price: 'not-a-number' })]);

    const result = await fetchCoinMarkets();

    expect(result.source).toBe('fallback');
    expect(result.data.length).toBeGreaterThan(0);
  });
});
