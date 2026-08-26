import type { OnboardingQuestionOption } from './preferences.js';

/**
 * The coins offered during onboarding, keyed by CoinGecko id. Static rather
 * than fetched: the price and news integrations both key on this list, and
 * Cointelegraph's tag slugs cannot be derived from any upstream response.
 */
export const curatedAssets = [
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
] as const satisfies readonly OnboardingQuestionOption[];

export const curatedAssetIds = curatedAssets.map((asset) => asset.value);

export type AssetId = (typeof curatedAssets)[number]['value'];
