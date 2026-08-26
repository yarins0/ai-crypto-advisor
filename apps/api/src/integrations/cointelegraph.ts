import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

import { getCachedContent } from '../lib/cache.js';
import type { CachedContent } from '../lib/cache.js';
import { fetchOk } from '../lib/http.js';
import { newsFallback } from './fallbacks/news.js';

const COINTELEGRAPH_TAG_RSS_URL = 'https://cointelegraph.com/rss/tag/';
const NEWS_TTL_SECONDS = 600;
const NEWS_CACHE_KEY_PREFIX = 'cointelegraph:v1:tag:';

// Cointelegraph tags these two by ticker rather than by their CoinGecko id.
const TAG_SLUG_OVERRIDES: Record<string, string> = {
  binancecoin: 'bnb',
  'avalanche-2': 'avalanche',
};

export function toTagSlug(assetId: string): string {
  return TAG_SLUG_OVERRIDES[assetId] ?? assetId;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  imageUrl: string | null;
}

// isArray: a feed carrying exactly one <item> otherwise parses to a bare object.
// parseTagValue: every field read here is text, and a wholly numeric headline
// would otherwise arrive as a number and fail validation for the whole feed.
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === 'item',
  parseTagValue: false,
});

// guid carries an isPermaLink attribute, so it parses to { '#text': ... }
// rather than a plain string; this normalizes either shape to the string.
const xmlTextNode = z
  .union([z.string(), z.object({ '#text': z.string() }).passthrough()])
  .transform((value) => (typeof value === 'string' ? value : value['#text']));

const mediaAttributesSchema = z.object({ '@_url': z.string() }).passthrough();

const rssItemSchema = z
  .object({
    title: z.string(),
    pubDate: z.string(),
    guid: xmlTextNode,
    link: z.string(),
    'media:content': mediaAttributesSchema.optional(),
    enclosure: mediaAttributesSchema.optional(),
  })
  .passthrough();

const rssFeedSchema = z
  .object({
    rss: z
      .object({
        channel: z
          .object({
            item: z.array(rssItemSchema).default([]),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

type RssItem = z.infer<typeof rssItemSchema>;

function toIsoDate(pubDate: string): string {
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid pubDate in Cointelegraph feed: ${pubDate}`);
  }
  return date.toISOString();
}

// Link is user-visible and shareable; utm_* tracking params do not belong in it.
function stripUtmParams(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.search = '';
  return url.toString();
}

function toNewsItem(item: RssItem): NewsItem {
  const imageUrl = item['media:content']?.['@_url'] ?? item.enclosure?.['@_url'] ?? null;

  return {
    id: item.guid,
    title: item.title,
    url: stripUtmParams(item.link),
    publishedAt: toIsoDate(item.pubDate),
    imageUrl,
  };
}

async function fetchNewsFromUpstream(slug: string): Promise<NewsItem[]> {
  const response = await fetchOk(`${COINTELEGRAPH_TAG_RSS_URL}${slug}`);
  const xml = await response.text();
  const parsed: unknown = xmlParser.parse(xml);
  const feed = rssFeedSchema.parse(parsed);
  return feed.rss.channel.item.map(toNewsItem);
}

export async function fetchNewsForAsset(assetId: string): Promise<CachedContent<NewsItem[]>> {
  const slug = toTagSlug(assetId);

  return getCachedContent({
    key: `${NEWS_CACHE_KEY_PREFIX}${slug}`,
    ttlSeconds: NEWS_TTL_SECONDS,
    fetcher: () => fetchNewsFromUpstream(slug),
    fallback: () => [...newsFallback],
  });
}
