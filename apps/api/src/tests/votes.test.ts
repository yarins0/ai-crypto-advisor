import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { voteResponseSchema, votesListResponseSchema } from '@aca/shared';
import type {
  AssetId,
  CoinMarket,
  ContentType,
  VoteResponse,
  VoteSummaryResponse,
  VotesListResponse,
} from '@aca/shared';

import { createApp } from '../app.js';
import { COIN_MARKETS_CACHE_KEY } from '../integrations/coingecko.js';
import { ContentCacheModel } from '../lib/cache.js';
import { PreferenceModel } from '../modules/preferences/model.js';
import type { VoteContext } from '../modules/votes/model.js';
import { VoteModel } from '../modules/votes/model.js';

const VALID_PASSWORD = 'Sup3rSecret!';
// Preference.version defaults to 0 and upsertPreferences $incs it on every write,
// so the PUT that completes onboarding leaves a freshly onboarded user at 1.
const ONBOARDED_PREFERENCE_VERSION = 1;
const app = createApp();

const BITCOIN_COIN: CoinMarket = {
  id: 'bitcoin',
  symbol: 'btc',
  name: 'Bitcoin',
  image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
  currentPrice: 80_000,
  priceChangePercentage24h: -1.5,
  marketCap: 1_500_000_000_000,
  sparkline: [79_000, 79_500, 80_000],
};

const COSMOS_COIN: CoinMarket = {
  id: 'cosmos',
  symbol: 'atom',
  name: 'Cosmos',
  image: 'https://assets.coingecko.com/coins/images/1481/large/cosmos_hub.png',
  currentPrice: 4.5,
  priceChangePercentage24h: -2.6,
  marketCap: 1_755_000_000,
  sparkline: [4.62, 4.58, 4.55, 4.52, 4.48, 4.51, 4.5],
};

function uniqueEmail(): string {
  return `user-${randomUUID()}@example.com`;
}

interface PreferencesOverrides {
  assets?: AssetId[];
  contentTypes?: ContentType[];
}

interface OnboardedUser {
  accessToken: string;
  userId: string;
}

async function registerAndOnboard(overrides: PreferencesOverrides = {}): Promise<OnboardedUser> {
  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send({ email: uniqueEmail(), name: 'Test User', password: VALID_PASSWORD });
  const accessToken = (registerResponse.body as { accessToken: string }).accessToken;

  await request(app)
    .put('/api/preferences')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      assets: overrides.assets ?? ['bitcoin'],
      investorType: 'hodler',
      contentTypes: overrides.contentTypes ?? ['prices'],
      riskTolerance: 'medium',
    });

  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
  return { accessToken, userId: (me.body as { id: string }).id };
}

// Bypasses the coingecko HTTP boundary (already covered by coingecko.test.ts)
// and writes straight to the shared content cache that resolveVotedItem
// reads from — the layer this file's tests actually care about.
async function seedCoinMarketsCache(
  coins: CoinMarket[],
  fetchedAt: Date = new Date(),
): Promise<void> {
  await ContentCacheModel.create({ key: COIN_MARKETS_CACHE_KEY, payload: coins, fetchedAt });
}

function buildVoteContext(overrides: Partial<VoteContext> = {}): VoteContext {
  return {
    preferenceVersion: 1,
    assets: ['bitcoin'],
    investorType: 'hodler',
    contentTypes: ['prices'],
    riskTolerance: 'medium',
    servedAt: new Date(),
    itemMeta: { title: 'Bitcoin', coinId: 'bitcoin', source: 'live' },
    ...overrides,
  };
}

afterEach(() => {
  // fileParallelism is disabled, so every test file shares one worker; a
  // leaked fetch stub here would poison tests run after this one.
  vi.restoreAllMocks();
});

describe('POST /api/votes', () => {
  it('rejects a non-onboarded user with 403', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), name: 'Test User', password: VALID_PASSWORD });
    const accessToken = (registerResponse.body as { accessToken: string }).accessToken;

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(403);
  });

  it('casts a valid vote on a real item and returns a schema-valid response', async () => {
    await seedCoinMarketsCache([BITCOIN_COIN]);
    const { accessToken } = await registerAndOnboard();

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(200);
    expect(() => voteResponseSchema.parse(response.body)).not.toThrow();
    const { vote } = response.body as VoteResponse;
    expect(vote).toMatchObject({ section: 'prices', itemId: 'bitcoin', value: 1 });
  });

  it('updates the same row on a re-vote rather than creating a second one', async () => {
    await seedCoinMarketsCache([BITCOIN_COIN]);
    const { accessToken, userId } = await registerAndOnboard();

    await request(app).post('/api/votes').set('Authorization', `Bearer ${accessToken}`).send({
      section: 'prices',
      itemId: 'bitcoin',
      value: 1,
      preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
    });
    const second = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: -1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(second.status).toBe(200);
    const rows = await VoteModel.find({ userId, section: 'prices', itemId: 'bitcoin' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(-1);
  });

  it('deletes the row and returns a null vote when value is 0', async () => {
    await seedCoinMarketsCache([BITCOIN_COIN]);
    const { accessToken, userId } = await registerAndOnboard();
    await request(app).post('/api/votes').set('Authorization', `Bearer ${accessToken}`).send({
      section: 'prices',
      itemId: 'bitcoin',
      value: 1,
      preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
    });

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: 0,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ vote: null });
    const rows = await VoteModel.find({ userId, section: 'prices', itemId: 'bitcoin' });
    expect(rows).toHaveLength(0);
  });

  it('clears an item that was never voted on idempotently', async () => {
    const { accessToken } = await registerAndOnboard();

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: 0,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ vote: null });
  });

  // clearVote must not need to resolve the item, so an itemId that has aged
  // out of every cache and upstream feed can still be cleared. Asserting
  // fetch was never called proves clearing does not depend on resolution.
  it('clears a vote for an itemId that can no longer be resolved, without calling any upstream', async () => {
    const { accessToken } = await registerAndOnboard();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'long-gone-coin',
        value: 0,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ vote: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a vote on an itemId that does not exist in any section source with 404', async () => {
    await seedCoinMarketsCache([BITCOIN_COIN]);
    const { accessToken } = await registerAndOnboard();

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'not-a-real-coin',
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Item not found' });
  });

  it("rejects an insight vote when the user hasn't selected insight, even for today's UTC day", async () => {
    const { accessToken } = await registerAndOnboard({ contentTypes: ['prices'] });
    const todayUtc = new Date().toISOString().slice(0, 10);

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'insight',
        itemId: todayUtc,
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(404);
  });

  it("rejects a memes vote when the user hasn't selected memes, even for a real curated meme id", async () => {
    const { accessToken } = await registerAndOnboard({ contentTypes: ['prices'] });

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'memes',
        itemId: 'hodl-1',
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(404);
  });

  it("rejects a prices vote for a curated coin outside the user's tracked assets", async () => {
    await seedCoinMarketsCache([BITCOIN_COIN, COSMOS_COIN]);
    const { accessToken } = await registerAndOnboard({
      assets: ['bitcoin'],
      contentTypes: ['prices'],
    });

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'cosmos',
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(404);
  });

  // Regression guard for the fix above: a coin the user does track must still resolve.
  it('still accepts a prices vote for a coin the user does track', async () => {
    await seedCoinMarketsCache([BITCOIN_COIN, COSMOS_COIN]);
    const { accessToken } = await registerAndOnboard({
      assets: ['bitcoin'],
      contentTypes: ['prices'],
    });

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(200);
  });

  it('rejects a news vote for an item belonging to an asset the user does not track', async () => {
    // Only the tracked asset's feed (bitcoin) is ever fetched, so it always
    // comes back empty here — no need to fabricate a real ethereum item id.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>', {
        status: 200,
      }),
    );
    const { accessToken } = await registerAndOnboard({
      assets: ['bitcoin'],
      contentTypes: ['news'],
    });

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'news',
        itemId: 'some-ethereum-article',
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(404);
  });

  // Editing preferences moves both the contentTypes guard and the stored version
  // past what the clear below sends, so this covers every check clearing bypasses.
  it('still clears a vote for a section the user has since deselected', async () => {
    await seedCoinMarketsCache([BITCOIN_COIN]);
    const { accessToken } = await registerAndOnboard({
      assets: ['bitcoin'],
      contentTypes: ['prices'],
    });
    await request(app).post('/api/votes').set('Authorization', `Bearer ${accessToken}`).send({
      section: 'prices',
      itemId: 'bitcoin',
      value: 1,
      preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
    });

    await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        assets: ['bitcoin'],
        investorType: 'hodler',
        contentTypes: ['news'],
        riskTolerance: 'medium',
      });

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: 0,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ vote: null });
  });

  // This is the trust-boundary test: the persisted context must reflect only
  // the server's own preference document and resolved item, never anything
  // the client sent alongside the valid fields.
  it('builds the persisted context entirely server-side, discarding client-supplied context/itemMeta/servedAt', async () => {
    await seedCoinMarketsCache([BITCOIN_COIN]);
    const { accessToken, userId } = await registerAndOnboard({
      assets: ['bitcoin'],
      contentTypes: ['prices'],
    });

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
        context: {
          preferenceVersion: 999,
          assets: ['ethereum'],
          investorType: 'day_trader',
          contentTypes: ['memes'],
          servedAt: '2000-01-01T00:00:00.000Z',
          itemMeta: { title: 'forged' },
        },
        itemMeta: { title: 'forged-top-level' },
        servedAt: '2000-01-01T00:00:00.000Z',
      });

    expect(response.status).toBe(200);
    const stored = await VoteModel.findOne({ userId, section: 'prices', itemId: 'bitcoin' });
    expect(stored).not.toBeNull();
    const context = stored?.context as VoteContext;
    expect(context.preferenceVersion).toBe(1);
    expect(context.assets).toEqual(['bitcoin']);
    expect(context.investorType).toBe('hodler');
    expect(context.contentTypes).toEqual(['prices']);
    expect(context.riskTolerance).toBe('medium');
    expect(context.itemMeta.title).toBe('Bitcoin');
    expect(JSON.stringify(context)).not.toContain('forged');
  });

  it("records the item's own served timestamp, not the moment the vote was cast", async () => {
    const servedAt = new Date(Date.now() - 30_000); // within the 60s TTL, but well before "now"
    await seedCoinMarketsCache([BITCOIN_COIN], servedAt);
    const { accessToken, userId } = await registerAndOnboard();
    const beforeVote = Date.now();

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(200);
    const stored = await VoteModel.findOne({ userId, section: 'prices', itemId: 'bitcoin' });
    const context = stored?.context as VoteContext;
    expect(context.servedAt.getTime()).toBe(servedAt.getTime());
    expect(context.servedAt.getTime()).toBeLessThan(beforeVote);
  });

  it('rejects an invalid value with 400 and a fields object', async () => {
    const { accessToken } = await registerAndOnboard();

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: 2,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(400);
    expect(response.body.fields).toHaveProperty('value');
  });

  it('rejects an unknown section with 400', async () => {
    const { accessToken } = await registerAndOnboard();

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'not-a-real-section',
        itemId: 'bitcoin',
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION,
      });

    expect(response.status).toBe(400);
  });

  it('rejects a vote with a stale preferenceVersion with 409 and writes no row', async () => {
    await seedCoinMarketsCache([BITCOIN_COIN]);
    const { accessToken, userId } = await registerAndOnboard();

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: 1,
        preferenceVersion: ONBOARDED_PREFERENCE_VERSION + 1,
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Preferences changed' });
    const rows = await VoteModel.find({ userId, section: 'prices', itemId: 'bitcoin' });
    expect(rows).toHaveLength(0);
  });

  // A stale version is rejected outright, so the two are never observably
  // different at write time. Deriving the expectation from the Preference
  // document is what would still catch a context echoed from the request body.
  it("stores context.preferenceVersion from the Preference document's current version", async () => {
    await seedCoinMarketsCache([BITCOIN_COIN]);
    const { accessToken, userId } = await registerAndOnboard();
    await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        assets: ['bitcoin'],
        investorType: 'hodler',
        contentTypes: ['prices'],
        riskTolerance: 'medium',
      });
    const preference = await PreferenceModel.findOne({ userId });
    const currentVersion = preference?.version;

    const response = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        section: 'prices',
        itemId: 'bitcoin',
        value: 1,
        preferenceVersion: currentVersion,
      });

    expect(response.status).toBe(200);
    const stored = await VoteModel.findOne({ userId, section: 'prices', itemId: 'bitcoin' });
    const context = stored?.context as VoteContext;
    expect(context.preferenceVersion).toBe(currentVersion);
  });
});

describe('GET /api/votes', () => {
  it('rejects a request with no Authorization header with 401', async () => {
    const response = await request(app).get('/api/votes');

    expect(response.status).toBe(401);
  });

  it('rejects a non-onboarded user with 403', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), name: 'Test User', password: VALID_PASSWORD });
    const accessToken = (registerResponse.body as { accessToken: string }).accessToken;

    const response = await request(app)
      .get('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  it("returns only the calling user's votes in a schema-valid response", async () => {
    const { accessToken, userId } = await registerAndOnboard();
    await VoteModel.create({
      userId,
      section: 'prices',
      itemId: 'bitcoin',
      value: 1,
      context: buildVoteContext(),
    });
    await VoteModel.create({
      userId: new mongoose.Types.ObjectId(),
      section: 'prices',
      itemId: 'ethereum',
      value: 1,
      context: buildVoteContext({ assets: ['ethereum'], itemMeta: { title: 'Ethereum' } }),
    });

    const response = await request(app)
      .get('/api/votes')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(() => votesListResponseSchema.parse(response.body)).not.toThrow();
    const { votes } = response.body as VotesListResponse;
    expect(votes.map((vote) => vote.itemId)).toEqual(['bitcoin']);
  });
});

describe('GET /api/votes/summary', () => {
  it("counts only the calling user's votes", async () => {
    const { accessToken, userId } = await registerAndOnboard();
    await VoteModel.create({
      userId,
      section: 'prices',
      itemId: 'bitcoin',
      value: 1,
      context: buildVoteContext(),
    });
    await VoteModel.create({
      userId: new mongoose.Types.ObjectId(),
      section: 'prices',
      itemId: 'ethereum',
      value: 1,
      context: buildVoteContext({ assets: ['ethereum'], itemMeta: { title: 'Ethereum' } }),
    });

    const response = await request(app)
      .get('/api/votes/summary')
      .set('Authorization', `Bearer ${accessToken}`);
    const { summary } = response.body as VoteSummaryResponse;

    expect(summary.totals).toEqual({ up: 1, down: 0 });
  });

  it('matches totals to the seeded votes', async () => {
    const { accessToken, userId } = await registerAndOnboard();
    await VoteModel.create([
      { userId, section: 'prices', itemId: 'bitcoin', value: 1, context: buildVoteContext() },
      { userId, section: 'prices', itemId: 'ethereum', value: -1, context: buildVoteContext() },
      { userId, section: 'prices', itemId: 'solana', value: -1, context: buildVoteContext() },
    ]);

    const response = await request(app)
      .get('/api/votes/summary')
      .set('Authorization', `Bearer ${accessToken}`);
    const { summary } = response.body as VoteSummaryResponse;

    expect(summary.totals).toEqual({ up: 1, down: 2 });
  });

  it('includes only the sections the user actually voted in', async () => {
    const { accessToken, userId } = await registerAndOnboard();
    await VoteModel.create({
      userId,
      section: 'prices',
      itemId: 'bitcoin',
      value: 1,
      context: buildVoteContext(),
    });

    const response = await request(app)
      .get('/api/votes/summary')
      .set('Authorization', `Bearer ${accessToken}`);
    const { summary } = response.body as VoteSummaryResponse;

    expect(summary.bySection.map((row) => row.section)).toEqual(['prices']);
  });

  it('returns bySection in a deterministic order across repeated calls', async () => {
    const { accessToken, userId } = await registerAndOnboard();
    await VoteModel.create([
      {
        userId,
        section: 'news',
        itemId: 'a',
        value: 1,
        context: buildVoteContext({ contentTypes: ['news'] }),
      },
      { userId, section: 'prices', itemId: 'bitcoin', value: 1, context: buildVoteContext() },
      {
        userId,
        section: 'memes',
        itemId: 'hodl-1',
        value: -1,
        context: buildVoteContext({ contentTypes: ['memes'] }),
      },
    ]);

    const first = await request(app)
      .get('/api/votes/summary')
      .set('Authorization', `Bearer ${accessToken}`);
    const second = await request(app)
      .get('/api/votes/summary')
      .set('Authorization', `Bearer ${accessToken}`);

    expect((first.body as VoteSummaryResponse).summary.bySection).toEqual(
      (second.body as VoteSummaryResponse).summary.bySection,
    );
  });
});
