import { z } from 'zod';

import { contentSources } from './content.js';

export const coinMarketSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string(),
  currentPrice: z.number(),
  priceChangePercentage24h: z.number().nullable(),
  marketCap: z.number(),
  sparkline: z.array(z.number()),
});

export const newsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  publishedAt: z.string().datetime(),
  imageUrl: z.string().nullable(),
});

/** `id` is the UTC calendar day, which is also what a vote on the insight keys on. */
export const insightSchema = z.object({
  id: z.string(),
  text: z.string(),
  // null when the deterministic template produced it rather than an LLM.
  model: z.string().nullable(),
});

export const memeSchema = z.object({
  id: z.string(),
  title: z.string(),
  imageUrl: z.string(),
});

/**
 * Every section reports which tier of the degradation path answered and when
 * that data was fetched, so the UI can badge stale data rather than hide it.
 */
function sectionSchema<TData extends z.ZodTypeAny>(dataSchema: TData) {
  return z.object({
    data: dataSchema,
    source: z.enum(contentSources),
    fetchedAt: z.string().datetime(),
  });
}

export const newsSectionSchema = sectionSchema(z.array(newsItemSchema));
export const pricesSectionSchema = sectionSchema(z.array(coinMarketSchema));
export const insightSectionSchema = sectionSchema(insightSchema);
export const memeSectionSchema = sectionSchema(memeSchema);

/**
 * Sections are always present and null when the user did not select them.
 * Optional keys would make an accidentally dropped section indistinguishable
 * from a deselected one, and this schema is what the client parses.
 */
export const dashboardResponseSchema = z.object({
  sections: z.object({
    news: newsSectionSchema.nullable(),
    prices: pricesSectionSchema.nullable(),
    insight: insightSectionSchema.nullable(),
    memes: memeSectionSchema.nullable(),
  }),
  generatedAt: z.string().datetime(),
});

export const memeRerollResponseSchema = z.object({ meme: memeSectionSchema });

export type CoinMarket = z.infer<typeof coinMarketSchema>;
export type NewsItem = z.infer<typeof newsItemSchema>;
export type Insight = z.infer<typeof insightSchema>;
export type Meme = z.infer<typeof memeSchema>;
export type NewsSection = z.infer<typeof newsSectionSchema>;
export type PricesSection = z.infer<typeof pricesSectionSchema>;
export type InsightSection = z.infer<typeof insightSectionSchema>;
export type MemeSection = z.infer<typeof memeSectionSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type MemeRerollResponse = z.infer<typeof memeRerollResponseSchema>;
