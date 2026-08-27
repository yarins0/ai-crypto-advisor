import { z } from 'zod';

import type { OnboardingQuestionOption } from './preferences.js';

/**
 * The coins offered during onboarding, keyed by CoinGecko id. Static rather
 * than fetched: the price and news integrations both key on this list, and
 * Cointelegraph's tag slugs cannot be derived from any upstream response.
 *
 * Declared as the tuple rather than derived from the labelled list below, so
 * `assetIdSchema` can be a real `z.enum` without a cast.
 */
export const curatedAssetIds = [
  'bitcoin',
  'ethereum',
  'solana',
  'binancecoin',
  'ripple',
  'cardano',
  'dogecoin',
  'polkadot',
  'chainlink',
  'litecoin',
  'avalanche-2',
  'tron',
  'stellar',
  'uniswap',
  'cosmos',
] as const;

export type AssetId = (typeof curatedAssetIds)[number];

// Keyed by AssetId rather than written as pairs: adding an id above without a
// label here is a compile error, not a blank checkbox in the onboarding quiz.
const ASSET_LABELS: Record<AssetId, string> = {
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  solana: 'Solana',
  binancecoin: 'BNB',
  ripple: 'XRP',
  cardano: 'Cardano',
  dogecoin: 'Dogecoin',
  polkadot: 'Polkadot',
  chainlink: 'Chainlink',
  litecoin: 'Litecoin',
  'avalanche-2': 'Avalanche',
  tron: 'TRON',
  stellar: 'Stellar',
  uniswap: 'Uniswap',
  cosmos: 'Cosmos',
};

export const curatedAssets: readonly OnboardingQuestionOption[] = curatedAssetIds.map((id) => ({
  value: id,
  label: ASSET_LABELS[id],
}));

/**
 * Rejects any id the price and news integrations cannot serve. Without this the
 * API accepts a mistyped coin and the failure only surfaces as an empty
 * dashboard section, two layers from where it entered.
 */
export const assetIdSchema = z.enum(curatedAssetIds);
