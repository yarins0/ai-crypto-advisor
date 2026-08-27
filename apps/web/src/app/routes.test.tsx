import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { AuthResponse } from '@aca/shared';

import { SESSION_QUERY_KEY } from '../features/auth/use-session.js';
import { createQueryClient } from '../lib/query-client.js';
import { AppRoutes } from './routes.js';

// Held pending rather than resolved: these tests assert where the router landed,
// and a real request would only add retries and noise to that question.
vi.mock('../features/onboarding/api.js', () => ({
  fetchOnboardingQuestions: vi.fn(() => new Promise(() => undefined)),
  savePreferences: vi.fn(),
}));

const ONBOARDED_SESSION: AuthResponse = {
  user: {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada',
    onboardedAt: '2026-01-01T00:00:00.000Z',
    isDemo: false,
  },
  accessToken: 'access-token',
};

const UNONBOARDED_SESSION: AuthResponse = {
  ...ONBOARDED_SESSION,
  user: { ...ONBOARDED_SESSION.user, onboardedAt: null },
};

function PathnameProbe() {
  return <span data-testid="pathname">{useLocation().pathname}</span>;
}

/**
 * Seeds the session cache so the guards resolve without a network call. `null`
 * is a cached value where `undefined` would mean "not loaded yet", which is why
 * a signed-out session is modelled as null rather than an absent entry.
 */
function renderAt(route: string, session: AuthResponse | null) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, session);

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <PathnameProbe />
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function currentPathname(): string | null {
  return screen.getByTestId('pathname').textContent;
}

describe('AppRoutes', () => {
  it('sends a signed-out visitor from the dashboard to the sign-in screen', () => {
    renderAt('/', null);

    expect(currentPathname()).toBe('/login');
  });

  it('sends a signed-in user who has not onboarded to the onboarding screen', () => {
    renderAt('/', UNONBOARDED_SESSION);

    expect(currentPathname()).toBe('/onboarding');
  });

  it('renders the dashboard for a signed-in user who has onboarded', () => {
    renderAt('/', ONBOARDED_SESSION);

    expect(currentPathname()).toBe('/');
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  // Without this the onboarding redirect and the catch-all route bounce a user
  // with no preferences between '/' and '/onboarding' indefinitely.
  it('lets a user who has not onboarded stay on the onboarding screen', () => {
    renderAt('/onboarding', UNONBOARDED_SESSION);

    expect(currentPathname()).toBe('/onboarding');
  });

  it('keeps an onboarded user away from the onboarding screen', () => {
    renderAt('/onboarding', ONBOARDED_SESSION);

    expect(currentPathname()).toBe('/');
  });

  it('keeps a signed-in user off the sign-in screen', () => {
    renderAt('/login', ONBOARDED_SESSION);

    expect(currentPathname()).toBe('/');
  });

  it('sends an unknown path to the dashboard route rather than rendering nothing', () => {
    renderAt('/not-a-page', ONBOARDED_SESSION);

    expect(currentPathname()).toBe('/');
  });
});
