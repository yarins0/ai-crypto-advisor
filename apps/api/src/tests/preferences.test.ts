import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { curatedAssetIds } from '@aca/shared';

import { createApp } from '../app.js';

const VALID_PASSWORD = 'Sup3rSecret!';

interface ErrorBody {
  error: string;
  fields?: Record<string, string>;
}

interface PreferencesPayload {
  assets: string[];
  investorType: string;
  contentTypes: string[];
  riskTolerance: string;
  version: number;
  updatedAt: string;
}

interface PreferencesGetBody {
  preferences: PreferencesPayload | null;
}

const app = createApp();

function uniqueEmail(): string {
  return `user-${randomUUID()}@example.com`;
}

const validPreferences = {
  assets: ['bitcoin', 'ethereum'],
  investorType: 'hodler',
  contentTypes: ['news', 'prices'],
  riskTolerance: 'medium',
};

async function registerUser(): Promise<{ accessToken: string }> {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ email: uniqueEmail(), name: 'Test User', password: VALID_PASSWORD });
  const body = response.body as { accessToken: string };
  return { accessToken: body.accessToken };
}

describe('GET /api/onboarding/questions', () => {
  it('rejects a request with no access token', async () => {
    const response = await request(app).get('/api/onboarding/questions');
    expect(response.status).toBe(401);
  });

  it('serves one question per preference field, built from the shared enums', async () => {
    const { accessToken } = await registerUser();

    const response = await request(app)
      .get('/api/onboarding/questions')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    const ids = (response.body.questions as Array<{ id: string }>).map((question) => question.id);
    expect(ids).toEqual(['contentTypes', 'assets', 'investorType', 'riskTolerance']);
  });
});

describe('GET /api/preferences', () => {
  it('rejects a request with no access token', async () => {
    const response = await request(app).get('/api/preferences');
    expect(response.status).toBe(401);
  });

  it('returns null before onboarding has been completed', async () => {
    const { accessToken } = await registerUser();

    const response = await request(app)
      .get('/api/preferences')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect((response.body as PreferencesGetBody).preferences).toBeNull();
  });
});

describe('PUT /api/preferences', () => {
  it('rejects a request with no access token', async () => {
    const response = await request(app).put('/api/preferences').send(validPreferences);
    expect(response.status).toBe(401);
  });

  it('rejects a body with an invalid investorType', async () => {
    const { accessToken } = await registerUser();

    const response = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validPreferences, investorType: 'not-a-real-type' });
    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).fields).toHaveProperty('investorType');
  });

  it('accepts every curated asset at once', async () => {
    const { accessToken } = await registerUser();

    const response = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validPreferences, assets: [...curatedAssetIds] });
    expect(response.status).toBe(200);
    const created = (response.body as { preferences: PreferencesPayload }).preferences;
    expect(created.assets).toEqual([...curatedAssetIds]);
  });

  it('rejects more assets than the curated list holds, even with a duplicate', async () => {
    const { accessToken } = await registerUser();

    const response = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validPreferences, assets: [...curatedAssetIds, curatedAssetIds[0]] });
    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).fields).toHaveProperty('assets');
  });

  it('rejects an asset id outside the curated list', async () => {
    const { accessToken } = await registerUser();

    const response = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validPreferences, assets: ['dogecoin', 'not-a-real-coin'] });
    expect(response.status).toBe(400);
    // Zod flags the offending element by its array index, not the array field
    // itself, so the key is "assets.1" rather than "assets".
    expect((response.body as ErrorBody).fields?.['assets.1']).toBeDefined();
  });

  it('creates preferences at version 1 and marks the user onboarded', async () => {
    const { accessToken } = await registerUser();

    const putResponse = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validPreferences);
    expect(putResponse.status).toBe(200);
    const created = (putResponse.body as { preferences: PreferencesPayload }).preferences;
    expect(created.version).toBe(1);
    expect(created.assets).toEqual(validPreferences.assets);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.body.onboardedAt).not.toBeNull();
  });

  // version exists so a vote can record which preference set was in force
  // when its item was served; a second submission must not reuse version 1.
  it('bumps the version on a second submission without resetting onboardedAt', async () => {
    const { accessToken } = await registerUser();

    await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validPreferences);
    const meAfterFirst = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    const onboardedAtAfterFirst = meAfterFirst.body.onboardedAt as string;

    const secondPut = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validPreferences, riskTolerance: 'high' });
    expect(secondPut.status).toBe(200);
    const updated = (secondPut.body as { preferences: PreferencesPayload }).preferences;
    expect(updated.version).toBe(2);
    expect(updated.riskTolerance).toBe('high');

    const meAfterSecond = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meAfterSecond.body.onboardedAt).toBe(onboardedAtAfterFirst);
  });
});
