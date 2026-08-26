import { z } from 'zod';

export const investorTypes = ['hodler', 'day_trader', 'nft_collector', 'yield_farmer'] as const;
export const contentTypes = ['news', 'prices', 'insight', 'memes'] as const;
export const riskTolerances = ['low', 'medium', 'high'] as const;

/** Assets are CoinGecko ids ('bitcoin'), never tickers — the price integration keys on them. */
export const preferencesRequestSchema = z.object({
  assets: z.array(z.string().min(1)).min(1).max(10),
  investorType: z.enum(investorTypes),
  contentTypes: z.array(z.enum(contentTypes)).min(1),
  riskTolerance: z.enum(riskTolerances),
});

export const preferencesResponseSchema = preferencesRequestSchema.extend({
  version: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

export type InvestorType = (typeof investorTypes)[number];
export type ContentType = (typeof contentTypes)[number];
export type RiskTolerance = (typeof riskTolerances)[number];
export type PreferencesRequest = z.infer<typeof preferencesRequestSchema>;
export type PreferencesResponse = z.infer<typeof preferencesResponseSchema>;
