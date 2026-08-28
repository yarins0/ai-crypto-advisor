import { z } from 'zod';

import { assetIdSchema, curatedAssetIds } from './assets.js';

export const investorTypes = ['hodler', 'day_trader', 'nft_collector', 'yield_farmer'] as const;

/**
 * The single section vocabulary: it selects which dashboard sections are
 * composed and which section a vote belongs to. One list, so a preference, a
 * response key and a vote row cannot disagree about what a section is called.
 */
export const contentTypes = ['news', 'prices', 'insight', 'memes'] as const;
export const riskTolerances = ['low', 'medium', 'high'] as const;

/** Assets are CoinGecko ids ('bitcoin'), never tickers — the price integration keys on them. */
export const preferencesRequestSchema = z.object({
  assets: z.array(assetIdSchema).min(1).max(curatedAssetIds.length),
  investorType: z.enum(investorTypes),
  contentTypes: z.array(z.enum(contentTypes)).min(1),
  riskTolerance: z.enum(riskTolerances),
});

export const preferencesResponseSchema = preferencesRequestSchema.extend({
  version: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

// Wrapped, not a bare nullable, because a user with no preferences yet is the
// routine state for every fresh signup, not an error GET should reject with.
export const preferencesGetResponseSchema = z.object({
  preferences: preferencesResponseSchema.nullable(),
});

const onboardingQuestionIds = ['assets', 'investorType', 'contentTypes', 'riskTolerance'] as const;
const onboardingQuestionTypes = ['single-select', 'multi-select'] as const;

export const onboardingQuestionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const onboardingQuestionSchema = z.object({
  id: z.enum(onboardingQuestionIds),
  label: z.string(),
  type: z.enum(onboardingQuestionTypes),
  options: z.array(onboardingQuestionOptionSchema),
  min: z.number().int().positive().optional(),
  max: z.number().int().positive().optional(),
});

export const onboardingQuestionsResponseSchema = z.object({
  questions: z.array(onboardingQuestionSchema),
});

export type InvestorType = (typeof investorTypes)[number];
export type ContentType = (typeof contentTypes)[number];
export type RiskTolerance = (typeof riskTolerances)[number];
export type PreferencesRequest = z.infer<typeof preferencesRequestSchema>;
export type PreferencesResponse = z.infer<typeof preferencesResponseSchema>;
export type PreferencesGetResponse = z.infer<typeof preferencesGetResponseSchema>;
export type OnboardingQuestionOption = z.infer<typeof onboardingQuestionOptionSchema>;
export type OnboardingQuestion = z.infer<typeof onboardingQuestionSchema>;
export type OnboardingQuestionsResponse = z.infer<typeof onboardingQuestionsResponseSchema>;
