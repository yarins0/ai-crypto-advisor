import type {
  ContentType,
  InvestorType,
  OnboardingQuestion,
  OnboardingQuestionOption,
  PreferencesRequest,
  PreferencesResponse,
  RiskTolerance,
} from '@aca/shared';
import { contentTypes, investorTypes, riskTolerances } from '@aca/shared';

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

/**
 * CoinGecko ids for a curated set of well-known coins. Static rather than
 * fetched live: M3 is what introduces the CoinGecko client, so nothing yet
 * can validate an arbitrary id against CoinGecko's own coin list.
 */
const CURATED_ASSETS: OnboardingQuestionOption[] = [
  { value: 'bitcoin', label: 'Bitcoin' },
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'solana', label: 'Solana' },
  { value: 'binancecoin', label: 'BNB' },
  { value: 'ripple', label: 'XRP' },
  { value: 'cardano', label: 'Cardano' },
  { value: 'dogecoin', label: 'Dogecoin' },
  { value: 'polkadot', label: 'Polkadot' },
  { value: 'chainlink', label: 'Chainlink' },
  { value: 'litecoin', label: 'Litecoin' },
  { value: 'avalanche-2', label: 'Avalanche' },
  { value: 'tron', label: 'TRON' },
  { value: 'stellar', label: 'Stellar' },
  { value: 'uniswap', label: 'Uniswap' },
  { value: 'cosmos', label: 'Cosmos' },
];

function toOptions<TValue extends string>(
  values: readonly TValue[],
  labels: Record<TValue, string>,
): OnboardingQuestionOption[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

/** Built from the same enums preferencesRequestSchema validates against, so the two cannot drift. */
export function getOnboardingQuestions(): OnboardingQuestion[] {
  return [
    {
      id: 'assets',
      label: 'Which coins do you want to track?',
      type: 'multi-select',
      options: CURATED_ASSETS,
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
      id: 'contentTypes',
      label: 'What do you want on your dashboard?',
      type: 'multi-select',
      options: toOptions(contentTypes, CONTENT_TYPE_LABELS),
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
