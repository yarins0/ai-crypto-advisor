import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
const VALID_PASSWORD = 'Sup3rSecret!';

interface PublicUser {
  id: string;
  email: string;
  name: string;
  onboardedAt: string | null;
  isDemo: boolean;
}

interface AuthSuccessBody {
  user: PublicUser;
  accessToken: string;
}

interface ErrorBody {
  error: string;
  fields?: Record<string, string>;
}

const app = createApp();

function uniqueEmail(): string {
  return `user-${randomUUID()}@example.com`;
}

/**
 * supertest's Response.headers type declares 'set-cookie' as a single string,
 * but Node's http module always delivers it as an array. This normalizes
 * that and returns just the "name=value" pair, ready to send back verbatim
 * in a request's Cookie header.
 */
function extractRefreshCookiePair(response: request.Response): string | undefined {
  const rawSetCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = rawSetCookie?.find((entry) => entry.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`));
  return cookie?.split(';')[0];
}

function isRefreshCookieCleared(response: request.Response): boolean {
  const rawSetCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = rawSetCookie?.find((entry) => entry.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`));
  if (!cookie) return false;
  const pair = cookie.split(';')[0] ?? '';
  const value = pair.slice(pair.indexOf('=') + 1);
  return value === '' || /max-age=0/i.test(cookie);
}

interface RegisteredUser {
  response: request.Response;
  accessToken: string;
  refreshCookie: string;
}

// Registration is the setup step for nearly every other test, so it is
// factored into one helper instead of repeated in each test body.
async function registerUser(
  overrides: Partial<{ email: string; name: string; password: string }> = {},
): Promise<RegisteredUser> {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      email: overrides.email ?? uniqueEmail(),
      name: overrides.name ?? 'Test User',
      password: overrides.password ?? VALID_PASSWORD,
    });

  const refreshCookie = extractRefreshCookiePair(response);
  if (!refreshCookie) {
    throw new Error('register response did not set a refresh_token cookie');
  }

  const body = response.body as AuthSuccessBody;
  return { response, accessToken: body.accessToken, refreshCookie };
}

describe('POST /api/auth/register', () => {
  it('creates a new user and returns an access token', async () => {
    const { response } = await registerUser();
    expect(response.status).toBe(201);
    const body = response.body as AuthSuccessBody;
    expect(body.accessToken.length).toBeGreaterThan(0);
    expect(body.user.onboardedAt).toBeNull();
    expect(body.user.isDemo).toBe(false);
  });

  it('never leaks the password hash in the response body', async () => {
    const { response } = await registerUser();
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    const rawUser = (response.body as AuthSuccessBody).user as unknown as Record<string, unknown>;
    expect(rawUser['passwordHash']).toBeUndefined();
    expect(rawUser['password']).toBeUndefined();
  });

  it('sets the refresh token only as an httpOnly cookie, never in the body', async () => {
    const { response, refreshCookie } = await registerUser();
    const rawSetCookie = response.headers['set-cookie'] as unknown as string[];
    const fullCookie = rawSetCookie.find((entry) =>
      entry.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`),
    );
    expect(fullCookie).toBeDefined();
    expect(fullCookie).toMatch(/HttpOnly/i);

    const rawToken = refreshCookie.split('=')[1] ?? '';
    expect(JSON.stringify(response.body)).not.toContain(rawToken);
  });

  it('rejects a second registration with the same email', async () => {
    const email = uniqueEmail();
    await registerUser({ email });

    const second = await request(app)
      .post('/api/auth/register')
      .send({ email, name: 'Second User', password: VALID_PASSWORD });
    expect(second.status).toBe(409);
  });

  it('normalizes email casing so a differently-cased login still matches', async () => {
    const localPart = randomUUID();
    const mixedCaseEmail = `${localPart}@Example.com`.toUpperCase();
    const lowerCaseEmail = `${localPart}@example.com`;

    await registerUser({ email: mixedCaseEmail });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: lowerCaseEmail, password: VALID_PASSWORD });
    expect(login.status).toBe(200);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), name: 'Test User', password: 'short1' });
    expect(response.status).toBe(400);
    const body = response.body as ErrorBody;
    expect(body.error).toBe('Validation failed');
    expect(body.fields).toHaveProperty('password');
  });

  it('rejects a malformed email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', name: 'Test User', password: VALID_PASSWORD });
    expect(response.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a user, access token, and a fresh refresh cookie for correct credentials', async () => {
    const email = uniqueEmail();
    await registerUser({ email });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: VALID_PASSWORD });
    expect(response.status).toBe(200);
    const body = response.body as AuthSuccessBody;
    expect(body.accessToken.length).toBeGreaterThan(0);
    expect(body.user.email).toBe(email);
    expect(extractRefreshCookiePair(response)).toBeDefined();
  });

  // Wrong password and unknown email must be indistinguishable, otherwise the
  // endpoint can be used to enumerate which email addresses have accounts.
  it('returns identical responses for a wrong password and an unknown email (anti-enumeration)', async () => {
    const email = uniqueEmail();
    await registerUser({ email });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail(), password: VALID_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect((wrongPassword.body as ErrorBody).error).toBe('Invalid email or password');
  });
});

describe('GET /api/auth/me', () => {
  it('rejects a request with no Authorization header', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
    expect((response.body as ErrorBody).error).toBe('Authentication required');
  });

  it('rejects a garbage bearer token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(response.status).toBe(401);
  });

  it('returns the public user for a valid access token', async () => {
    const email = uniqueEmail();
    const { accessToken } = await registerUser({ email });

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    const user = response.body as PublicUser;
    expect(user.email).toBe(email);
    expect(user.onboardedAt).toBeNull();
    expect(user.isDemo).toBe(false);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const { refreshCookie } = await registerUser();

    const response = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(response.status).toBe(200);
    const body = response.body as AuthSuccessBody;
    expect(body.accessToken.length).toBeGreaterThan(0);

    const newRefreshCookie = extractRefreshCookiePair(response);
    expect(newRefreshCookie).toBeDefined();
    expect(newRefreshCookie).not.toBe(refreshCookie);
  });

  it('rejects reuse of an already-rotated refresh token', async () => {
    const { refreshCookie } = await registerUser();

    await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    const reused = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);

    expect(reused.status).toBe(401);
    expect((reused.body as ErrorBody).error).toBe('Invalid refresh token');
  });

  it('rejects a refresh request with no cookie', async () => {
    const response = await request(app).post('/api/auth/refresh');
    expect(response.status).toBe(401);
  });

  // A stolen refresh token cannot outlive its detection: replaying a token
  // that has already been rotated away must revoke every later token in its
  // family too, not just the replayed one.
  it('cannot outlive detection: replaying a rotated-away token invalidates its whole family', async () => {
    const { refreshCookie: tokenA } = await registerUser();

    const firstRefresh = await request(app).post('/api/auth/refresh').set('Cookie', tokenA);
    const tokenB = extractRefreshCookiePair(firstRefresh);
    if (!tokenB) throw new Error('refresh did not set a new refresh_token cookie');

    const replayOfA = await request(app).post('/api/auth/refresh').set('Cookie', tokenA);
    expect(replayOfA.status).toBe(401);

    const attemptWithB = await request(app).post('/api/auth/refresh').set('Cookie', tokenB);
    expect(attemptWithB.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the refresh token cookie and returns no content', async () => {
    const { refreshCookie } = await registerUser();

    const response = await request(app).post('/api/auth/logout').set('Cookie', refreshCookie);
    expect(response.status).toBe(204);
    expect(isRefreshCookieCleared(response)).toBe(true);
  });

  it('invalidates the refresh token so it cannot be used after logout', async () => {
    const { refreshCookie } = await registerUser();

    await request(app).post('/api/auth/logout').set('Cookie', refreshCookie);
    const response = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(response.status).toBe(401);
  });

  // Logout is idempotent: a client with no session left must still get a
  // clean success response, not an error.
  it('returns 204 even with no refresh token cookie present', async () => {
    const response = await request(app).post('/api/auth/logout');
    expect(response.status).toBe(204);
  });
});
