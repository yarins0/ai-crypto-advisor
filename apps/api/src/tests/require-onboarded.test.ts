import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const VALID_PASSWORD = 'Sup3rSecret!';

const validPreferences = {
  assets: ['bitcoin'],
  investorType: 'hodler',
  contentTypes: ['news'],
  riskTolerance: 'medium',
};

const app = createApp();

function uniqueEmail(): string {
  return `user-${randomUUID()}@example.com`;
}

async function registerUser(): Promise<{ accessToken: string }> {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ email: uniqueEmail(), name: 'Test User', password: VALID_PASSWORD });
  return { accessToken: (response.body as { accessToken: string }).accessToken };
}

// GET /api/votes/summary sits behind requireOnboarded and needs no upstream
// integration or seeded data, so it is a clean route to exercise the guard.
describe('requireOnboarded', () => {
  it('rejects a non-onboarded user with 403, not 401 or 500', async () => {
    const { accessToken } = await registerUser();

    const response = await request(app)
      .get('/api/votes/summary')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Onboarding required' });
  });

  // Mongoose strips `undefined` from a query, so { _id: undefined } would
  // match the first document rather than none — this guards against that
  // widening into "some onboarded user exists" for an unauthenticated caller.
  it('rejects a request with no Authorization header with 401', async () => {
    const response = await request(app).get('/api/votes/summary');

    expect(response.status).toBe(401);
  });

  it('lets an onboarded user through', async () => {
    const { accessToken } = await registerUser();
    await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validPreferences);

    const response = await request(app)
      .get('/api/votes/summary')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });
});
