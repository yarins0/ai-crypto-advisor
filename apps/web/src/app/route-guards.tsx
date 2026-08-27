import { Navigate, Outlet } from 'react-router';

import { FullPageSpinner } from '../components/FullPageSpinner.js';
import { useSession } from '../features/auth/use-session.js';

/**
 * Every redirect below replaces the current entry rather than pushing one, so
 * the back button cannot land the user on a route a guard just sent them off.
 */

/** Gate for signed-in routes; the tree behind it can assume a session exists. */
export function RequireAuth() {
  const { data: session, isPending } = useSession();
  if (isPending) {
    return <FullPageSpinner />;
  }
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

/**
 * Mirrors the API's requireOnboarded guard, which answers 403 for a user with no
 * preference document. Redirecting on the client means they meet the wizard
 * instead of an error, but the server stays the authority on who is onboarded.
 */
export function RequireOnboarded() {
  const { data: session } = useSession();
  return session?.user.onboardedAt ? <Outlet /> : <Navigate to="/onboarding" replace />;
}

/** Keeps an already signed-in user off the login and register screens. */
export function PublicOnly() {
  const { data: session, isPending } = useSession();
  if (isPending) {
    return <FullPageSpinner />;
  }
  return session ? <Navigate to="/" replace /> : <Outlet />;
}
