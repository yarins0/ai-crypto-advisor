/**
 * Smoke test for the auth (M1), preferences (M2) and dashboard/votes (M4)
 * APIs: drives a running server end to end over HTTP and prints a pass/fail
 * line for every behaviour each milestone promises. Complements the unit
 * suite, which runs against an in-memory database and so cannot prove cookie
 * attributes, index enforcement or refresh-token rotation against a real
 * deployment.
 *
 * Local:     npm run smoke
 * Deployed:  BASE_URL=https://<host> npm run smoke
 *
 * Exits 0 when every check passes, 1 otherwise, so CI can gate on it.
 *
 * It creates one throwaway user in whatever database the server points at,
 * and deletes that user and everything referencing it when the run ends —
 * whether the checks passed or not — as long as MONGODB_URI resolves to that
 * same database. `npm run smoke` loads apps/api/.env for exactly this, since
 * local and deployed runs share the one Atlas cluster; without a resolvable
 * MONGODB_URI, cleanup is skipped and the manual command is printed instead.
 */

import { setTimeout as sleep } from 'node:timers/promises';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000';
// Mirrors REFRESH_REUSE_GRACE_MS in apps/api/src/modules/auth/service.ts. The API
// forgives a replay inside that interval as a lost rotation race, so a replay sent
// immediately exercises the grace path rather than theft detection.
const REFRESH_REUSE_GRACE_MS = 3000;
const REFRESH_COOKIE_NAME = 'refresh_token';
const PASSWORD = 'Sup3rSecret!';

const results = [];

/** Records one assertion without stopping the run, so every check reports. */
function check(label, didPass, detail = '') {
  results.push({ label, didPass, detail });
  const mark = didPass ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${label}${detail ? `  — ${detail}` : ''}`);
}

/** Pulls the "name=value" pair for the refresh cookie out of a response. */
function readRefreshCookie(response) {
  const cookie = response.headers
    .getSetCookie()
    .find((entry) => entry.startsWith(`${REFRESH_COOKIE_NAME}=`));
  return cookie ? { pair: cookie.split(';')[0], full: cookie } : undefined;
}

async function call(path, { method = 'GET', body, accessToken, cookie } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { response, status: response.status, body: parsed };
}

/**
 * Deletes the throwaway user and every document that references it, so a
 * repeated `npm run smoke` never accumulates data in a real database. Runs
 * whether the checks above passed or failed — a failed run still created the
 * user via the first request in the flow.
 */
async function cleanUpTestUser(userId, email) {
  if (!process.env.MONGODB_URI) {
    console.log(`\nMONGODB_URI not set — delete the test user by hand:`);
    console.log(`  db.users.deleteOne({ email: "${email}" })`);
    return;
  }

  // mongoose is CommonJS, so a dynamic import lands its exports under
  // `.default` rather than on the namespace object itself.
  const { default: mongoose } = await import('mongoose');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    for (const collection of ['preferences', 'votes', 'refreshtokens']) {
      await db.collection(collection).deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
    }
    await db.collection('users').deleteOne({ _id: new mongoose.Types.ObjectId(userId) });
    console.log(`\nTest user cleaned up: ${email}`);
  } catch (error) {
    console.log(`\nCould not clean up the test user automatically: ${error.message}`);
    console.log(`  db.users.deleteOne({ email: "${email}" })`);
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  const email = `verify-${Date.now()}@example.com`;
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Test user: ${email}\n`);

  // --- health -------------------------------------------------------------
  const health = await call('/api/health');
  check('health returns 200', health.status === 200, JSON.stringify(health.body));

  // --- register -----------------------------------------------------------
  const register = await call('/api/auth/register', {
    method: 'POST',
    body: { email, name: 'Verification User', password: PASSWORD },
  });
  check('register returns 201', register.status === 201, `got ${register.status}`);
  check('register returns an access token', typeof register.body?.accessToken === 'string');
  check('new user is not onboarded yet', register.body?.user?.onboardedAt === null);
  const userId = register.body?.user?.id;

  const registerCookie = readRefreshCookie(register.response);
  check('register sets a refresh cookie', Boolean(registerCookie));
  check('refresh cookie is httpOnly', /httponly/i.test(registerCookie?.full ?? ''));
  check(
    'refresh cookie is scoped to /api/auth',
    /path=\/api\/auth/i.test(registerCookie?.full ?? ''),
  );

  const serialized = JSON.stringify(register.body);
  check('response body never contains the password hash', !serialized.includes('passwordHash'));
  const rawRefreshToken = registerCookie?.pair.split('=')[1] ?? '';
  check('response body never contains the refresh token', !serialized.includes(rawRefreshToken));

  // --- duplicate email ----------------------------------------------------
  const duplicate = await call('/api/auth/register', {
    method: 'POST',
    body: { email, name: 'Impostor', password: PASSWORD },
  });
  check(
    'duplicate email is rejected with 409',
    duplicate.status === 409,
    `got ${duplicate.status}`,
  );

  // --- validation ---------------------------------------------------------
  const shortPassword = await call('/api/auth/register', {
    method: 'POST',
    body: { email: `x-${Date.now()}@example.com`, name: 'Short', password: 'abc' },
  });
  check('short password is rejected with 400', shortPassword.status === 400);
  check(
    'validation error names the offending field',
    Boolean(shortPassword.body?.fields?.password),
  );

  // --- anti-enumeration ---------------------------------------------------
  const wrongPassword = await call('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'definitely-not-it' },
  });
  const unknownEmail = await call('/api/auth/login', {
    method: 'POST',
    body: { email: `ghost-${Date.now()}@example.com`, password: PASSWORD },
  });
  check('wrong password returns 401', wrongPassword.status === 401);
  check('unknown email returns 401', unknownEmail.status === 401);
  check(
    'wrong password and unknown email are indistinguishable',
    JSON.stringify(wrongPassword.body) === JSON.stringify(unknownEmail.body),
    JSON.stringify(wrongPassword.body),
  );

  // --- protected route ----------------------------------------------------
  const meAnonymous = await call('/api/auth/me');
  check('GET /me without a token returns 401', meAnonymous.status === 401);

  const meGarbage = await call('/api/auth/me', { accessToken: 'not-a-real-token' });
  check('GET /me with a garbage token returns 401', meGarbage.status === 401);

  const me = await call('/api/auth/me', { accessToken: register.body?.accessToken });
  check('GET /me with a valid token returns 200', me.status === 200);
  check('GET /me returns the right user', me.body?.email === email, me.body?.email);

  // --- rotation -----------------------------------------------------------
  const firstRefresh = await call('/api/auth/refresh', {
    method: 'POST',
    cookie: registerCookie?.pair,
  });
  check('refresh with a valid cookie returns 200', firstRefresh.status === 200);
  const rotatedCookie = readRefreshCookie(firstRefresh.response);
  check('refresh issues a different refresh token', rotatedCookie?.pair !== registerCookie?.pair);

  // --- replay detection ---------------------------------------------------
  await sleep(REFRESH_REUSE_GRACE_MS + 500);
  const replay = await call('/api/auth/refresh', { method: 'POST', cookie: registerCookie?.pair });
  check('replaying the consumed token returns 401', replay.status === 401);

  const afterReplay = await call('/api/auth/refresh', {
    method: 'POST',
    cookie: rotatedCookie?.pair,
  });
  check(
    'replay revokes the whole family, so the newer token dies too',
    afterReplay.status === 401,
    `got ${afterReplay.status}`,
  );

  // --- logout -------------------------------------------------------------
  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
  check('login with correct credentials returns 200', login.status === 200);
  const loginCookie = readRefreshCookie(login.response);

  const logout = await call('/api/auth/logout', { method: 'POST', cookie: loginCookie?.pair });
  check('logout returns 204', logout.status === 204);

  const afterLogout = await call('/api/auth/refresh', {
    method: 'POST',
    cookie: loginCookie?.pair,
  });
  check('refresh after logout returns 401', afterLogout.status === 401);

  const logoutNoCookie = await call('/api/auth/logout', { method: 'POST' });
  check('logout with no cookie is still 204 (idempotent)', logoutNoCookie.status === 204);

  // --- onboarding + preferences --------------------------------------------
  const accessToken = register.body?.accessToken;

  const preferencesAnonymous = await call('/api/preferences');
  check('GET /preferences without a token returns 401', preferencesAnonymous.status === 401);

  const questionsAnonymous = await call('/api/onboarding/questions');
  check('GET /onboarding/questions without a token returns 401', questionsAnonymous.status === 401);

  const questions = await call('/api/onboarding/questions', { accessToken });
  check('GET /onboarding/questions returns 200', questions.status === 200);
  const questionIds = questions.body?.questions?.map((question) => question.id);
  check(
    'onboarding has exactly the 4 expected questions in order',
    JSON.stringify(questionIds) ===
      JSON.stringify(['contentTypes', 'assets', 'investorType', 'riskTolerance']),
    JSON.stringify(questionIds),
  );

  const preferencesBeforeSubmission = await call('/api/preferences', { accessToken });
  check(
    'GET /preferences returns 200 before any submission',
    preferencesBeforeSubmission.status === 200,
  );
  check(
    'preferences is null before any submission',
    preferencesBeforeSubmission.body?.preferences === null,
  );

  const invalidPreferences = await call('/api/preferences', {
    method: 'PUT',
    accessToken,
    body: {
      assets: ['bitcoin'],
      investorType: 'whale',
      contentTypes: ['news'],
      riskTolerance: 'low',
    },
  });
  check('PUT /preferences with a bad investorType returns 400', invalidPreferences.status === 400);
  check(
    'validation error names investorType',
    Boolean(invalidPreferences.body?.fields?.investorType),
  );

  // requireOnboarded gates dashboard and votes on a preference document that
  // does not exist yet at this point in the flow, so both must 403 here.
  const dashboardBeforeOnboarding = await call('/api/dashboard', { accessToken });
  check(
    'GET /dashboard before onboarding returns 403',
    dashboardBeforeOnboarding.status === 403,
    `got ${dashboardBeforeOnboarding.status}`,
  );

  const votesSummaryBeforeOnboarding = await call('/api/votes/summary', { accessToken });
  check(
    'GET /votes/summary before onboarding returns 403',
    votesSummaryBeforeOnboarding.status === 403,
    `got ${votesSummaryBeforeOnboarding.status}`,
  );

  const firstSubmission = await call('/api/preferences', {
    method: 'PUT',
    accessToken,
    body: {
      assets: ['bitcoin', 'ethereum'],
      investorType: 'hodler',
      contentTypes: ['news', 'prices'],
      riskTolerance: 'medium',
    },
  });
  check('first PUT /preferences returns 200', firstSubmission.status === 200);
  check(
    'first PUT /preferences starts at version 1',
    firstSubmission.body?.preferences?.version === 1,
  );

  const meAfterFirstSubmission = await call('/api/auth/me', { accessToken });
  check(
    'onboardedAt is set after the first submission',
    meAfterFirstSubmission.body?.onboardedAt !== null,
  );
  const onboardedAtAfterFirstSubmission = meAfterFirstSubmission.body?.onboardedAt;

  const secondSubmission = await call('/api/preferences', {
    method: 'PUT',
    accessToken,
    body: {
      assets: ['solana'],
      investorType: 'day_trader',
      contentTypes: ['memes'],
      riskTolerance: 'high',
    },
  });
  check('second PUT /preferences returns 200', secondSubmission.status === 200);
  check(
    'second PUT /preferences bumps version to 2',
    secondSubmission.body?.preferences?.version === 2,
  );

  const meAfterSecondSubmission = await call('/api/auth/me', { accessToken });
  check(
    'onboardedAt is unchanged by the second submission',
    meAfterSecondSubmission.body?.onboardedAt === onboardedAtAfterFirstSubmission,
    `first ${onboardedAtAfterFirstSubmission} vs second ${meAfterSecondSubmission.body?.onboardedAt}`,
  );

  // --- dashboard (M4) -------------------------------------------------------
  const dashboardAnonymous = await call('/api/dashboard');
  check('GET /dashboard without a token returns 401', dashboardAnonymous.status === 401);

  const CHOSEN_ASSETS = ['bitcoin', 'ethereum'];
  const dashboardPreferences = await call('/api/preferences', {
    method: 'PUT',
    accessToken,
    body: {
      assets: CHOSEN_ASSETS,
      investorType: 'hodler',
      contentTypes: ['news', 'prices'],
      riskTolerance: 'medium',
    },
  });
  check(
    'third PUT /preferences (dashboard fixture) returns 200',
    dashboardPreferences.status === 200,
  );

  const dashboard = await call('/api/dashboard', { accessToken });
  check('GET /dashboard after onboarding returns 200', dashboard.status === 200);

  const sections = dashboard.body?.sections ?? {};
  check(
    'dashboard sections include all four keys',
    ['news', 'prices', 'insight', 'memes'].every((key) => key in sections),
    JSON.stringify(Object.keys(sections)),
  );
  check('unselected insight section is null', sections.insight === null);
  check('unselected memes section is null', sections.memes === null);
  check('selected prices section is not null', sections.prices !== null);
  check(
    'selected prices section has data, a live/cache/fallback source and a parseable fetchedAt',
    Array.isArray(sections.prices?.data) &&
      ['live', 'cache', 'fallback'].includes(sections.prices?.source) &&
      !Number.isNaN(Date.parse(sections.prices?.fetchedAt ?? '')),
  );
  const priceAssetIds = (sections.prices?.data ?? []).map((coin) => coin.id);
  check(
    'prices data contains only the chosen assets',
    priceAssetIds.every((id) => CHOSEN_ASSETS.includes(id)),
    JSON.stringify(priceAssetIds),
  );
  check(
    'dashboard generatedAt is a parseable ISO timestamp',
    !Number.isNaN(Date.parse(dashboard.body?.generatedAt ?? '')),
  );

  // Read from the dashboard rather than the PUT /preferences reply so these
  // checks fail if the dashboard stops serving the version a vote must echo.
  const preferenceVersion = dashboard.body?.preferenceVersion;
  check(
    'dashboard serves a top-level preferenceVersion',
    typeof preferenceVersion === 'number',
    JSON.stringify(preferenceVersion),
  );

  // --- meme reroll ------------------------------------------------------
  const firstMeme = await call('/api/dashboard/meme', { accessToken });
  check('GET /dashboard/meme returns 200', firstMeme.status === 200);
  check('meme reroll returns a meme section', Boolean(firstMeme.body?.meme?.data?.id));

  const secondMeme = await call(`/api/dashboard/meme?exclude=${firstMeme.body?.meme?.data?.id}`, {
    accessToken,
  });
  check(
    'excluding the previous meme id returns a different one',
    secondMeme.body?.meme?.data?.id !== firstMeme.body?.meme?.data?.id,
    `${firstMeme.body?.meme?.data?.id} vs ${secondMeme.body?.meme?.data?.id}`,
  );

  // --- votes (M4) ---------------------------------------------------------
  const voteItemId = sections.prices?.data?.[0]?.id;

  const upvote = await call('/api/votes', {
    method: 'POST',
    accessToken,
    body: { section: 'prices', itemId: voteItemId, value: 1, preferenceVersion },
  });
  check('POST /votes with value 1 returns 200', upvote.status === 200, `got ${upvote.status}`);
  check('upvote is recorded with value 1', upvote.body?.vote?.value === 1);

  const flippedVote = await call('/api/votes', {
    method: 'POST',
    accessToken,
    body: { section: 'prices', itemId: voteItemId, value: -1, preferenceVersion },
  });
  check('re-voting the same item returns 200', flippedVote.status === 200);
  check(
    're-voting the same item upserts the new value rather than duplicating it',
    flippedVote.body?.vote?.value === -1,
  );

  const summaryAfterVote = await call('/api/votes/summary', { accessToken });
  const pricesTallyAfterVote = summaryAfterVote.body?.summary?.bySection?.find(
    (row) => row.section === 'prices',
  );
  check(
    'vote summary reflects the downvote',
    pricesTallyAfterVote?.up === 0 && pricesTallyAfterVote?.down === 1,
    JSON.stringify(pricesTallyAfterVote),
  );

  const clearedVote = await call('/api/votes', {
    method: 'POST',
    accessToken,
    body: { section: 'prices', itemId: voteItemId, value: 0, preferenceVersion },
  });
  check('clearing a vote (value 0) returns 200', clearedVote.status === 200);
  check('clearing a vote returns a null vote', clearedVote.body?.vote === null);

  const summaryAfterClear = await call('/api/votes/summary', { accessToken });
  const pricesTallyAfterClear = summaryAfterClear.body?.summary?.bySection?.find(
    (row) => row.section === 'prices',
  );
  check(
    'vote summary no longer counts the cleared vote',
    (pricesTallyAfterClear?.down ?? 0) === 0,
    JSON.stringify(pricesTallyAfterClear),
  );

  const bogusItemVote = await call('/api/votes', {
    method: 'POST',
    accessToken,
    body: { section: 'prices', itemId: 'not-a-real-coin-id', value: 1, preferenceVersion },
  });
  check(
    'voting on an unresolvable item returns 404',
    bogusItemVote.status === 404,
    `got ${bogusItemVote.status}`,
  );

  const invalidValueVote = await call('/api/votes', {
    method: 'POST',
    accessToken,
    body: { section: 'prices', itemId: voteItemId, value: 2 },
  });
  check('voting with an out-of-range value returns 400', invalidValueVote.status === 400);

  // --- summary ------------------------------------------------------------
  const failed = results.filter((entry) => !entry.didPass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log('\nFailures:');
    for (const entry of failed) console.log(`  - ${entry.label} ${entry.detail}`);
  }
  if (userId) {
    await cleanUpTestUser(userId, email);
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\nVerification could not run:', error.message);
  console.error('Is the API running?  npm run dev');
  process.exit(1);
});
