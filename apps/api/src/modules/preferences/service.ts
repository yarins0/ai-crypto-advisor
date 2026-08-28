import type {
  ContentType,
  InvestorType,
  OnboardingQuestion,
  OnboardingQuestionOption,
  PreferencesRequest,
  PreferencesResponse,
  RiskTolerance,
} from '@aca/shared';
import { contentTypes, curatedAssets, investorTypes, riskTolerances } from '@aca/shared';

import { UserModel } from '../auth/user.model.js';
import { PreferenceModel } from './model.js';
import type { PreferenceDocument } from './model.js';

const MIN_ASSETS = 1;
const MAX_ASSETS = 10;

const INVESTOR_TYPE_LABELS: Record<InvestorType, string> = {
  hodler: 'Hodler',
  day_trader: 'Day Trader',
  nft_collector: 'NFT Collector',
  yield_farmer: 'Yield Farmer',
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  news: 'News',
  prices: 'Prices',
  insight: 'AI Insight',
  memes: 'Memes',
};

const RISK_TOLERANCE_LABELS: Record<RiskTolerance, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function toOptions<TValue extends string>(
  values: readonly TValue[],
  labels: Record<TValue, string>,
): OnboardingQuestionOption[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

/**
 * Built from the same enums preferencesRequestSchema validates against, so the two cannot drift.
 * Content types leads: it is the only answer that decides whether the remaining
 * questions are worth asking, and the client skips the tuning pair without it.
 */
export function getOnboardingQuestions(): OnboardingQuestion[] {
  return [
    {
      id: 'contentTypes',
      label: 'What do you want on your dashboard?',
      type: 'multi-select',
      options: toOptions(contentTypes, CONTENT_TYPE_LABELS),
    },
    {
      id: 'assets',
      label: 'Which coins do you want to track?',
      type: 'multi-select',
      options: [...curatedAssets],
      min: MIN_ASSETS,
      max: MAX_ASSETS,
    },
    {
      id: 'investorType',
      label: 'How would you describe yourself?',
      type: 'single-select',
      options: toOptions(investorTypes, INVESTOR_TYPE_LABELS),
    },
    {
      id: 'riskTolerance',
      label: "What's your risk tolerance?",
      type: 'single-select',
      options: toOptions(riskTolerances, RISK_TOLERANCE_LABELS),
    },
  ];
}

function toPreferencesResponse(preference: PreferenceDocument): PreferencesResponse {
  return {
    assets: preference.assets,
    investorType: preference.investorType,
    contentTypes: preference.contentTypes,
    riskTolerance: preference.riskTolerance,
    version: preference.version,
    updatedAt: preference.updatedAt.toISOString(),
  };
}

export async function getPreferences(userId: string): Promise<PreferencesResponse | null> {
  const preference = await PreferenceModel.findOne({ userId });
  return preference ? toPreferencesResponse(preference) : null;
}

/**
 * One atomic write creates or updates the preference document and bumps
 * `version` in the same operation, so two concurrent submissions from the
 * same user can never both read the same version and overwrite each other.
 */
export async function upsertPreferences(
  userId: string,
  input: PreferencesRequest,
): Promise<PreferencesResponse> {
  const preference = await PreferenceModel.findOneAndUpdate(
    { userId },
    { $set: input, $inc: { version: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  // Scoped to onboardedAt: null so this fires once, on the submission that
  // completes onboarding, not on every later edit.
  await UserModel.updateOne({ _id: userId, onboardedAt: null }, { onboardedAt: new Date() });

  // upsert + new guarantee a document; mongoose's types can't express that.
  return toPreferencesResponse(preference!);
}
