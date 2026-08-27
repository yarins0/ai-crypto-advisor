import { authResponseSchema } from '@aca/shared';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@aca/shared';

import { ApiError, apiRequest, apiRequestVoid, refreshSession } from '../../lib/api/client.js';
import { setAccessToken } from '../../lib/api/session.js';

const UNAUTHORIZED_STATUS = 401;

export async function login(input: LoginRequest): Promise<AuthResponse> {
  const session = await apiRequest('/api/auth/login', authResponseSchema, {
    method: 'POST',
    body: input,
  });
  setAccessToken(session.accessToken);
  return session;
}

export async function register(input: RegisterRequest): Promise<AuthResponse> {
  const session = await apiRequest('/api/auth/register', authResponseSchema, {
    method: 'POST',
    body: input,
  });
  setAccessToken(session.accessToken);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await apiRequestVoid('/api/auth/logout', { method: 'POST' });
  } finally {
    // Dropped even when the revoke call failed: a network error must not leave
    // the user apparently signed in with a token the server may have killed.
    setAccessToken(null);
  }
}

/**
 * Restores a session from the refresh cookie on boot, since the access token
 * lives only in memory and a reload starts without one.
 */
export async function loadSession(): Promise<AuthResponse | null> {
  try {
    return await refreshSession();
  } catch (error) {
    // No usable cookie is the ordinary state on a first visit or after logout,
    // so it resolves to "signed out" rather than surfacing as a failure.
    if (error instanceof ApiError && error.status === UNAUTHORIZED_STATUS) {
      return null;
    }
    throw error;
  }
}
