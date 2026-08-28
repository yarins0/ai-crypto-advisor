import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiRequest } from './client.js';
import { getAccessToken, setAccessToken } from './session.js';

const REFRESH_PATH = '/api/auth/refresh';

const AUTH_PAYLOAD = {
  user: {
    id: 'user-1',
    email: 'demo@example.com',
    name: 'Demo',
    onboardedAt: null,
    isDemo: false,
  },
  accessToken: 'fresh-token',
};

/** Passes the body through untouched: these tests exercise transport, not schemas. */
const passThroughParser = { parse: (data: unknown): unknown => data };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function readAuthorization(init?: RequestInit): string | null {
  return init?.headers instanceof Headers ? init.headers.get('Authorization') : null;
}

/**
 * Answers 401 the first time each path is requested and 200 afterwards, which
 * is the shape of an expired access token that a refresh then repairs.
 */
function stubExpiredAccessToken(refreshStatus = 200): ReturnType<typeof vi.fn> {
  const alreadyRequested = new Set<string>();
  const fetchMock = vi.fn((input: string, init?: RequestInit) => {
    if (input === REFRESH_PATH) {
      const body = refreshStatus === 200 ? AUTH_PAYLOAD : { error: 'Invalid refresh token' };
      return Promise.resolve(jsonResponse(refreshStatus, body));
    }
    if (alreadyRequested.has(input)) {
      return Promise.resolve(jsonResponse(200, { ok: true, sentWith: readAuthorization(init) }));
    }
    alreadyRequested.add(input);
    return Promise.resolve(jsonResponse(401, { error: 'Authentication required' }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function countRefreshCalls(fetchMock: ReturnType<typeof vi.fn>): number {
  return fetchMock.mock.calls.filter(([path]) => path === REFRESH_PATH).length;
}

beforeEach(() => {
  setAccessToken('stale-token');
});

describe('apiRequest', () => {
  // The API revokes a user's entire refresh-token family when a rotated-away
  // token is replayed, so a second parallel refresh logs them out everywhere.
  it('refreshes exactly once when concurrent requests are all rejected with 401', async () => {
    const fetchMock = stubExpiredAccessToken();

    await Promise.all([
      apiRequest('/api/dashboard', passThroughParser),
      apiRequest('/api/votes', passThroughParser),
      apiRequest('/api/votes/summary', passThroughParser),
    ]);

    expect(countRefreshCalls(fetchMock)).toBe(1);
  });

  it('retries with the refreshed access token rather than the one that was rejected', async () => {
    const fetchMock = stubExpiredAccessToken();

    await apiRequest('/api/dashboard', passThroughParser);

    const dashboardCalls = fetchMock.mock.calls.filter(([path]) => path === '/api/dashboard');
    expect(dashboardCalls.map(([, init]) => readAuthorization(init as RequestInit))).toEqual([
      'Bearer stale-token',
      'Bearer fresh-token',
    ]);
  });

  it('surfaces the failure without recursing when the refresh is itself rejected', async () => {
    const fetchMock = stubExpiredAccessToken(401);

    await expect(apiRequest('/api/dashboard', passThroughParser)).rejects.toBeInstanceOf(ApiError);

    expect(countRefreshCalls(fetchMock)).toBe(1);
    // A dead session must not leave a token attached to later requests.
    expect(getAccessToken()).toBeNull();
  });

  // A wrong password answers 401 as well, and no refresh can repair that: routing
  // it through the retry replaces the credential error with the refresh failure's.
  it('surfaces the endpoint message without refreshing when the request carried no token', async () => {
    setAccessToken(null);
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(401, { error: 'Invalid email or password' })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await apiRequest('/api/auth/login', passThroughParser, {
      method: 'POST',
      body: { email: 'demo@example.com', password: 'wrong' },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Invalid email or password');
    // One call total, so neither a refresh nor a retry was attempted.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports the validation field map from a 400 so a form can render per-field errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(400, {
            error: 'Validation failed',
            fields: { email: 'Invalid email', password: 'Password must be at least 8 characters' },
          }),
        ),
      ),
    );

    const error = await apiRequest('/api/auth/register', passThroughParser, {
      method: 'POST',
      body: { email: 'nope' },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).fields).toEqual({
      email: 'Invalid email',
      password: 'Password must be at least 8 characters',
    });
  });
});
