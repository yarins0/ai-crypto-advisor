/**
 * Contract check for the four M3 upstreams, run against the real internet.
 *
 * The unit suite mocks every network call, so nothing in it can detect a
 * third-party API changing shape or a news tag disappearing. This script is the
 * only thing that can. It is deliberately not in CI — it is external, rate
 * limited and occasionally flaky.
 *
 *   Run:  npm run check:integrations
 *
 * Exits non-zero if any check fails, so it can gate a deploy.
 */
import { curatedAssetIds } from '@aca/shared';

const COINGECKO_MARKETS_URL = 'https://api.coingecko.com/api/v3/coins/markets';
const COINTELEGRAPH_TAG_URL = 'https://cointelegraph.com/rss/tag';
const HUGGINGFACE_URL = 'https://router.huggingface.co/v1/chat/completions';

/** Mirrors TAG_SLUG_OVERRIDES in apps/api/src/integrations/cointelegraph.ts. */
const TAG_SLUG_OVERRIDES = {
  binancecoin: 'bnb',
  'avalanche-2': 'avalanche',
};

const results = [];

/** Records one assertion without stopping the run, so every check reports. */
function check(label, didPass, detail = '') {
  results.push({ label, didPass, detail });
  const mark = didPass ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${label}${detail ? `  — ${detail}` : ''}`);
}

/** Neither a pass nor a failure: the check could not run in this environment. */
function skip(label, reason) {
  console.log(`SKIP  ${label}  — ${reason}`);
}

function toTagSlug(assetId) {
  return TAG_SLUG_OVERRIDES[assetId] ?? assetId;
}

async function checkCoinGecko() {
  const params = new URLSearchParams({
    vs_currency: 'usd',
    ids: curatedAssetIds.join(','),
    sparkline: 'true',
    price_change_percentage: '24h',
  });

  const response = await fetch(`${COINGECKO_MARKETS_URL}?${params.toString()}`);
  check('coingecko markets responds 200 without an api key', response.ok, `got ${response.status}`);
  if (!response.ok) return;

  const markets = await response.json();
  check(
    'coingecko returns a row for every curated asset',
    Array.isArray(markets) && markets.length === curatedAssetIds.length,
    `got ${Array.isArray(markets) ? markets.length : typeof markets} of ${curatedAssetIds.length}`,
  );

  const missing = curatedAssetIds.filter((id) => !markets.some((market) => market.id === id));
  check('no curated id is unknown to coingecko', missing.length === 0, missing.join(', '));

  const first = markets[0];
  check('current_price is present and numeric', typeof first?.current_price === 'number');
  check(
    'sparkline_in_7d.price is a non-empty array',
    Array.isArray(first?.sparkline_in_7d?.price) && first.sparkline_in_7d.price.length > 0,
  );
}

async function checkCointelegraph() {
  for (const assetId of curatedAssetIds) {
    const slug = toTagSlug(assetId);
    const response = await fetch(`${COINTELEGRAPH_TAG_URL}/${slug}`);

    if (!response.ok) {
      check(`cointelegraph tag ${slug}`, false, `got ${response.status} (asset ${assetId})`);
      continue;
    }

    const xml = await response.text();
    const itemCount = (xml.match(/<item>/g) ?? []).length;
    // A 200 alone proves nothing: an empty feed is still well-formed RSS.
    check(`cointelegraph tag ${slug} has items`, itemCount > 0, `${itemCount} items`);
  }
}

async function checkHuggingFace() {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) {
    skip('huggingface chat completion', 'HUGGINGFACE_API_TOKEN not set');
    return;
  }

  const response = await fetch(HUGGINGFACE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model: process.env.HUGGINGFACE_MODEL ?? 'meta-llama/Llama-3.1-8B-Instruct',
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      max_tokens: 5,
    }),
  });

  check('huggingface responds 200', response.ok, `got ${response.status}`);
  if (!response.ok) return;

  const body = await response.json();
  check(
    'huggingface returns choices[0].message.content',
    typeof body?.choices?.[0]?.message?.content === 'string',
  );
}

async function main() {
  console.log('\nChecking M3 upstreams against the live internet.\n');

  // --- coingecko ----------------------------------------------------------
  await checkCoinGecko();

  // --- cointelegraph ------------------------------------------------------
  await checkCointelegraph();

  // --- hugging face -------------------------------------------------------
  await checkHuggingFace();

  // --- summary ------------------------------------------------------------
  const failed = results.filter((entry) => !entry.didPass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);

  if (failed.length > 0) {
    console.log('\nFailures:');
    for (const entry of failed) console.log(`  - ${entry.label} ${entry.detail}`);
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\nUpstream check could not run:', error.message);
  process.exit(1);
});
