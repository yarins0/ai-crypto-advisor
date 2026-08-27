import type { CoinMarket, Insight } from '@aca/shared';

import { env } from '../../env.js';
import { chatCompletion } from '../../integrations/huggingface.js';
import type { ChatMessage } from '../../integrations/huggingface.js';
import { getCachedContent } from '../../lib/cache.js';
import type { CachedContent } from '../../lib/cache.js';
import type { PreferenceDocument } from '../preferences/model.js';
import { INSIGHT_TTL_SECONDS, insightCacheKey, toUtcDay } from './insight-cache.js';

type InsightPreference = Pick<PreferenceDocument, 'assets' | 'investorType' | 'riskTolerance'>;

const MAX_PROMPT_COINS = 10;
const MAX_RESPONSE_WORDS_HINT = 100;

// Emphasis and heading markers only. Leading `-` bullets are left alone: they
// read as ordinary punctuation, where stripping them would run list items
// together into one unpunctuated line.
const MARKDOWN_SYNTAX = /(?:\*\*|__|[*_`])|^#{1,6}\s+/gm;

// No dollar amount is ever put in the prompt, so any in the reply is invented.
// Percentages go unchecked by design: they are supplied, and matching them back
// to source would trip the rejection below on every rounding difference.
const CURRENCY_FIGURE = /\$\s*\d/;

const SYSTEM_PROMPT =
  `You are a concise crypto market analyst. Keep the response under ${MAX_RESPONSE_WORDS_HINT} words. ` +
  'Write plain prose: no Markdown, headings, bold, italics or code formatting. ' +
  'Cite only the percentage changes given in the market data. Never state a dollar amount, ' +
  'a price, a price target, a stop-loss, or an entry or exit level. ' +
  'Explain what the data implies for the reader profile rather than instructing a specific trade.';

function toChangeLine(coin: CoinMarket): string {
  const change = coin.priceChangePercentage24h ?? 0;
  return `${coin.name}: ${change.toFixed(2)}% 24h`;
}

function buildPrompt(preference: InsightPreference, coins: CoinMarket[]): ChatMessage[] {
  const coinLines =
    coins.slice(0, MAX_PROMPT_COINS).map(toChangeLine).join('\n') || 'No market data available.';

  const userPrompt =
    `Write a short daily crypto insight for a ${preference.investorType} investor ` +
    `with ${preference.riskTolerance} risk tolerance, tracking: ${preference.assets.join(', ')}.\n\n` +
    `24h market moves:\n${coinLines}`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
}

/**
 * Generated text is untrusted input, not a trusted upstream payload, and the
 * prompt's rules are a request rather than a guarantee. Formatting mistakes are
 * repaired; a fabricated figure rejects the whole reply, handing the request to
 * getCachedContent's cache-then-fallback tiers rather than shipping a false number.
 */
async function fetchInsight(preference: InsightPreference, coins: CoinMarket[]): Promise<Insight> {
  const reply = await chatCompletion(buildPrompt(preference, coins));
  const text = reply.replaceAll(MARKDOWN_SYNTAX, '').trim();

  if (CURRENCY_FIGURE.test(text)) {
    throw new Error('Insight rejected: the reply quoted a dollar figure it was never given');
  }

  return { id: toUtcDay(), text, model: env.HF_MODEL };
}

interface Performers {
  best: CoinMarket;
  worst: CoinMarket;
}

// Avoids indexed array access under noUncheckedIndexedAccess: destructuring the
// head leaves `rest` to fold over without ever reading an index that could be
// out of bounds.
function findPerformers(coins: CoinMarket[]): Performers | null {
  const [first, ...rest] = coins;
  if (!first) return null;

  return rest.reduce<Performers>(
    (acc, coin) => {
      const change = coin.priceChangePercentage24h ?? 0;
      return {
        best: change > (acc.best.priceChangePercentage24h ?? 0) ? coin : acc.best,
        worst: change < (acc.worst.priceChangePercentage24h ?? 0) ? coin : acc.worst,
      };
    },
    { best: first, worst: first },
  );
}

/** Phrased without an indefinite article, which "nft collector" would not agree with. */
function describeProfile(preference: InsightPreference): string {
  const investorType = preference.investorType.replaceAll('_', ' ');
  return `your ${preference.riskTolerance}-risk ${investorType} profile`;
}

function toChangePercent(coin: CoinMarket): string {
  return (coin.priceChangePercentage24h ?? 0).toFixed(2);
}

// Every figure here comes from `coins`; nothing is invented, which is what
// lets the client trust a `model: null` insight as much as a live one.
function buildFallbackText(preference: InsightPreference, coins: CoinMarket[]): string {
  const performers = findPerformers(coins);
  if (!performers) {
    return (
      `No live market data is available right now for your ${preference.assets.length} tracked ` +
      `assets. Check back soon for a ${preference.riskTolerance}-risk update.`
    );
  }

  const { best, worst } = performers;

  // A single tracked asset is both the best and the worst performer, and
  // reporting it as each in one sentence reads as a bug.
  if (best.id === worst.id) {
    return (
      `Over the last 24h, ${best.name} moved ${toChangePercent(best)}% on your watchlist. ` +
      `Weigh that against ${describeProfile(preference)} before acting.`
    );
  }

  return (
    `Over the last 24h, ${best.name} led your watchlist at ${toChangePercent(best)}%, while ` +
    `${worst.name} lagged at ${toChangePercent(worst)}%. Weigh that swing against ` +
    `${describeProfile(preference)} before acting.`
  );
}

export async function getInsightForUser(
  userId: string,
  preference: InsightPreference,
  coins: CoinMarket[],
): Promise<CachedContent<Insight>> {
  return getCachedContent({
    key: insightCacheKey(userId),
    ttlSeconds: INSIGHT_TTL_SECONDS,
    fetcher: () => fetchInsight(preference, coins),
    fallback: () => ({ id: toUtcDay(), text: buildFallbackText(preference, coins), model: null }),
  });
}
