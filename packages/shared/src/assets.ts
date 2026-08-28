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

// Mirrors the `image` field CoinGecko's markets response carries for these same
// ids (see apps/api/src/integrations/fallbacks/coins.ts, which snapshots that
// response for the offline fallback tier). Static for the same reason the ids
// above are: the onboarding screen renders before any CoinGecko call is made.
const ASSET_IMAGES: Record<AssetId, string> = {
  bitcoin: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
  ethereum: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
  solana: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
  binancecoin: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
  ripple: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
  cardano: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
  dogecoin: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
  polkadot: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png',
  chainlink: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
  litecoin: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png',
  'avalanche-2':
    'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
  tron: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png',
  stellar: 'https://assets.coingecko.com/coins/images/100/large/Stellar_symbol_black_RGB.png',
  uniswap: 'https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png',
  cosmos: 'https://assets.coingecko.com/coins/images/1481/large/cosmos_hub.png',
};

export const curatedAssets: readonly OnboardingQuestionOption[] = curatedAssetIds.map((id) => ({
  value: id,
  label: ASSET_LABELS[id],
  image: ASSET_IMAGES[id],
}));

/**
 * Rejects any id the price and news integrations cannot serve. Without this the
 * API accepts a mistyped coin and the failure only surfaces as an empty
 * dashboard section, two layers from where it entered.
 */
export const assetIdSchema = z.enum(curatedAssetIds);
