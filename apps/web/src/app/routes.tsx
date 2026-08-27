import { Navigate, Route, Routes } from 'react-router';

import { LoginPage } from '../features/auth/LoginPage.js';
import { RegisterPage } from '../features/auth/RegisterPage.js';
import { DashboardPage } from '../features/dashboard/DashboardPage.js';
import { OnboardingPage } from '../features/onboarding/OnboardingPage.js';
import { PublicOnly, RequireAuth, RequireOnboarded } from './route-guards.js';

/**
 * Onboarding sits inside RequireAuth but outside RequireOnboarded: it is the one
 * signed-in route a user without preferences must be able to reach, or the
 * onboarding redirect and the catch-all below would bounce them back and forth.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<RequireOnboarded />}>
          <Route path="/" element={<DashboardPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
