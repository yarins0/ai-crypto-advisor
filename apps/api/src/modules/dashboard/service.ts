import type {
  AssetId,
  ContentSource,
  ContentType,
  DashboardResponse,
  MemeSection,
  NewsItem,
} from '@aca/shared';

import { newsFallback } from '../../integrations/fallbacks/news.js';
import { fetchCoinMarkets } from '../../integrations/coingecko.js';
import { fetchNewsForAsset } from '../../integrations/cointelegraph.js';
import { getRandomMeme } from '../../integrations/memes.js';
import type { CachedContent } from '../../lib/cache.js';
import { HttpError } from '../../lib/errors.js';
import { PreferenceModel } from '../preferences/model.js';
import type { PreferenceDocument } from '../preferences/model.js';
import { getInsightForUser } from './insight.js';

const MAX_NEWS_ITEMS = 12;
const MAX_MEME_REROLL_ATTEMPTS = 5;

const SOURCE_SEVERITY: Record<ContentSource, number> = { live: 0, cache: 1, fallback: 2 };

interface SectionEnvelope<TData> {
  data: TData;
  source: ContentSource;
  fetchedAt: string;
}

function toSection<TData>(content: CachedContent<TData>): SectionEnvelope<TData> {
  return { data: content.data, source: content.source, fetchedAt: content.fetchedAt.toISOString() };
}

function worstSource(sources: ContentSource[]): ContentSource {
  return sources.reduce((worst, source) =>
    SOURCE_SEVERITY[source] > SOURCE_SEVERITY[worst] ? source : worst,
  );
}

function oldestFetchedAt(dates: Date[]): Date {
  return dates.reduce((oldest, date) => (date < oldest ? date : oldest));
}

function dedupeAndSortNews(feeds: CachedContent<NewsItem[]>[]): NewsItem[] {
  const itemsById = new Map<string, NewsItem>();
  for (const feed of feeds) {
    for (const item of feed.data) {
      itemsById.set(item.id, item);
    }
  }
  // publishedAt is a validated ISO-8601 string, so lexicographic order matches
  // chronological order without parsing each one into a Date.
  return [...itemsById.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

// An empty merged feed is treated as worse than a live-but-empty upstream
// response: showing curated fallback articles beats showing nothing.
async function buildNewsSection(assets: AssetId[]): Promise<CachedContent<NewsItem[]>> {
  const feeds = await Promise.all(assets.map((assetId) => fetchNewsForAsset(assetId)));
  const items = dedupeAndSortNews(feeds).slice(0, MAX_NEWS_ITEMS);

  if (items.length === 0) {
    return { data: [...newsFallback], source: 'fallback', fetchedAt: new Date() };
  }

  return {
    data: items,
    source: worstSource(feeds.map((feed) => feed.source)),
    fetchedAt: oldestFetchedAt(feeds.map((feed) => feed.fetchedAt)),
  };
}

export function rerollMeme(excludeId?: string): MemeSection {
  let candidate = getRandomMeme();
  for (
    let attempt = 0;
    attempt < MAX_MEME_REROLL_ATTEMPTS && candidate.data.id === excludeId;
    attempt += 1
  ) {
    candidate = getRandomMeme();
  }
  return toSection(candidate);
}

async function loadPreference(userId: string): Promise<PreferenceDocument> {
  const preference = await PreferenceModel.findOne({ userId });
  if (!preference) {
    throw new HttpError(403, 'Onboarding required');
  }
  return preference;
}

export async function buildDashboard(userId: string): Promise<DashboardResponse> {
  const preference = await loadPreference(userId);
  const hasContentType = (type: ContentType): boolean => preference.contentTypes.includes(type);

  // Coin markets feed both `prices` and the insight prompt, so it is fetched
  // once, ahead of the parallel news/insight composition below.
  const marketData =
    hasContentType('prices') || hasContentType('insight') ? await fetchCoinMarkets() : null;
  const selectedAssetIds = new Set<string>(preference.assets);
  const coins = marketData ? marketData.data.filter((coin) => selectedAssetIds.has(coin.id)) : [];

  const [newsContent, insightContent] = await Promise.all([
    hasContentType('news') ? buildNewsSection(preference.assets) : Promise.resolve(null),
    hasContentType('insight')
      ? getInsightForUser(userId, preference, coins)
      : Promise.resolve(null),
  ]);

  return {
    sections: {
      news: newsContent ? toSection(newsContent) : null,
      // marketData is also fetched for a user who selected only `insight`, so
      // the section still has to be gated on the preference, not on its presence.
      prices:
        hasContentType('prices') && marketData
          ? toSection({ data: coins, source: marketData.source, fetchedAt: marketData.fetchedAt })
          : null,
      insight: insightContent ? toSection(insightContent) : null,
      memes: hasContentType('memes') ? rerollMeme() : null,
    },
    preferenceVersion: preference.version,
    generatedAt: new Date().toISOString(),
  };
}
