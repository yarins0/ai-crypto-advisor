import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AuthResponse } from '@aca/shared';

import { DASHBOARD_QUERY_KEY } from '../dashboard/use-dashboard.js';
import { createQueryClient } from '../../lib/query-client.js';
import { login } from './api.js';
import { SESSION_QUERY_KEY, useLogin } from './use-session.js';

vi.mock('./api.js', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  loadSession: vi.fn(),
}));

const SESSION: AuthResponse = {
  user: {
    id: 'user-2',
    email: 'grace@example.com',
    name: 'Grace',
    onboardedAt: '2026-01-01T00:00:00.000Z',
    isDemo: false,
  },
  accessToken: 'access-token',
};

function withQueryClient(queryClient: ReturnType<typeof createQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useLogin', () => {
  // A session can end while its cache stays warm, so the next sign-in has to
  // assume the entries in front of it belong to whoever signed in before.
  it('drops the previous account entries before seeding the new session', async () => {
    vi.mocked(login).mockResolvedValue(SESSION);
    const queryClient = createQueryClient();
    queryClient.setQueryData(DASHBOARD_QUERY_KEY, { belongsTo: 'the previous account' });

    const { result } = renderHook(() => useLogin(), { wrapper: withQueryClient(queryClient) });
    result.current.mutate({ email: 'grace@example.com', password: 'correct-horse' });

    // The clear runs inside this mutation's own callback, so success is asserted
    // as well: stranding it pending would leave the sign-in form spinning.
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(DASHBOARD_QUERY_KEY)).toBeUndefined();
    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toEqual(SESSION);
  });
});
