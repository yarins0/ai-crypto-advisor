import type { AssetId, ContentType } from '@aca/shared';

import { fetchCoinMarkets } from '../../integrations/coingecko.js';
import { fetchNewsForAsset } from '../../integrations/cointelegraph.js';
import { findMemeById } from '../../integrations/memes.js';
import { findCachedInsight, toUtcDay } from '../dashboard/insight-cache.js';
import type { PreferenceDocument } from '../preferences/model.js';
import type { VoteItemMeta } from './model.js';

/** What resolveVotedItem hands back: itemMeta fields plus the item's own servedAt. */
export type VotedItemMeta = VoteItemMeta & { servedAt: Date };

// The shared markets row covers every curated coin, so membership of the
// caller's own asset list is what narrows it to what they were served.
async function resolvePriceItem(itemId: string, assets: AssetId[]): Promise<VotedItemMeta | null> {
  if (!assets.some((assetId) => assetId === itemId)) {
    return null;
  }

  const { data, source, fetchedAt } = await fetchCoinMarkets();
  const coin = data.find((entry) => entry.id === itemId);
  return coin ? { title: coin.name, coinId: coin.id, source, servedAt: fetchedAt } : null;
}

async function resolveNewsItem(itemId: string, assets: AssetId[]): Promise<VotedItemMeta | null> {
  const feeds = await Promise.all(assets.map((assetId) => fetchNewsForAsset(assetId)));
  for (const feed of feeds) {
    const item = feed.data.find((entry) => entry.id === itemId);
    if (item) {
      return { title: item.title, source: feed.source, servedAt: feed.fetchedAt };
    }
  }
  return null;
}

function resolveMemeItem(itemId: string): VotedItemMeta | null {
  const meme = findMemeById(itemId);
  return meme ? { title: meme.title, source: 'live', servedAt: new Date() } : null;
}

/**
 * Not gated on a cache row: the deterministic templated insight is served
 * without writing one, so requiring a row would 404 a vote on an insight the
 * user can plainly see. userId + itemId (the UTC day) already identify the
 * insight authentically, so the cache lookup below is enrichment only.
 */
async function resolveInsightItem(userId: string, itemId: string): Promise<VotedItemMeta | null> {
  if (itemId !== toUtcDay()) {
    return null;
  }

  const cached = await findCachedInsight(userId);
  return cached
    ? { model: cached.insight.model ?? undefined, source: 'live', servedAt: cached.fetchedAt }
    : { source: 'fallback', servedAt: new Date() };
}

/** Rebuilds an item's metadata from the same shared cache row the dashboard served from. */
export async function resolveVotedItem(
  userId: string,
  section: ContentType,
  itemId: string,
  preference: PreferenceDocument,
): Promise<VotedItemMeta | null> {
  // A vote is only recordable for an item these preferences could have served.
  // Without this, votes accumulate for sections the user never enabled, and a
  // training row for content that was never shown is a mislabelled example.
  if (!preference.contentTypes.includes(section)) {
    return null;
  }

  switch (section) {
    case 'prices':
      return resolvePriceItem(itemId, preference.assets);
    case 'news':
      return resolveNewsItem(itemId, preference.assets);
    case 'memes':
      return resolveMemeItem(itemId);
    case 'insight':
      return resolveInsightItem(userId, itemId);
  }
}
