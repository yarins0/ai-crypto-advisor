import { z } from 'zod';

import { curatedAssetIds } from '@aca/shared';
import type { CoinMarket } from '@aca/shared';

import { getCachedContent } from '../lib/cache.js';
import type { CachedContent } from '../lib/cache.js';
import { fetchOk } from '../lib/http.js';
import { coinsFallback } from './fallbacks/coins.js';

const COINGECKO_MARKETS_URL = 'https://api.coingecko.com/api/v3/coins/markets';
const MARKETS_TTL_SECONDS = 60;

export const COIN_MARKETS_CACHE_KEY = 'coingecko:v1:markets';

// Only the fields this module maps are enumerated; passthrough lets upstream add
// fields without breaking this schema, while a missing mapped field still throws.
const coinMarketResponseSchema = z
  .object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    image: z.string(),
    current_price: z.number(),
    market_cap: z.number(),
    price_change_percentage_24h: z.number().nullable(),
    sparkline_in_7d: z.object({ price: z.array(z.number()) }),
  })
  .passthrough();

const coinMarketsResponseSchema = z.array(coinMarketResponseSchema);

function toCoinMarket(entry: z.infer<typeof coinMarketResponseSchema>): CoinMarket {
  return {
    id: entry.id,
    symbol: entry.symbol,
    name: entry.name,
    image: entry.image,
    currentPrice: entry.current_price,
    priceChangePercentage24h: entry.price_change_percentage_24h,
    marketCap: entry.market_cap,
    sparkline: entry.sparkline_in_7d.price,
  };
}

async function fetchCoinMarketsFromUpstream(): Promise<CoinMarket[]> {
  const params = new URLSearchParams({
    vs_currency: 'usd',
    ids: curatedAssetIds.join(','),
    sparkline: 'true',
    price_change_percentage: '24h',
  });

  const response = await fetchOk(`${COINGECKO_MARKETS_URL}?${params.toString()}`);
  const body: unknown = await response.json();
  return coinMarketsResponseSchema.parse(body).map(toCoinMarket);
}

// Single shared key covering every curated asset: one upstream call serves every
// visitor. M4 filters this list down to a user's chosen assets after the fact.
export async function fetchCoinMarkets(): Promise<CachedContent<CoinMarket[]>> {
  return getCachedContent({
    key: COIN_MARKETS_CACHE_KEY,
    ttlSeconds: MARKETS_TTL_SECONDS,
    fetcher: fetchCoinMarketsFromUpstream,
    fallback: () => [...coinsFallback],
  });
}
