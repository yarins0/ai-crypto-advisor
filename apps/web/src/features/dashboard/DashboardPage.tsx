import { FormBanner } from '../../components/FormBanner.js';
import { getFormMessage } from '../../lib/api/form-errors.js';
import { usePreferences } from '../preferences/use-preferences.js';
import { DashboardHeader } from './DashboardHeader.js';
import { DashboardSections } from './DashboardSections.js';
import { DashboardSkeleton } from './DashboardSkeleton.js';
import { useDashboard } from './use-dashboard.js';
import { useSectionOrder } from './use-section-order.js';

export function DashboardPage() {
  const dashboardQuery = useDashboard();
  // Fetched alongside the dashboard rather than in front of it: this only sizes
  // the placeholder, so gating the real paint on it would spend load time to
  // improve a loading state.
  const preferencesQuery = usePreferences();
  const [sectionOrder, setSectionOrder] = useSectionOrder();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Rendered above the query states so a failed dashboard still leaves the
          user a way to reach their preferences or sign out. */}
      <DashboardHeader />

      <div className="mt-6">
        {dashboardQuery.isError ? (
          <FormBanner
            message={getFormMessage(dashboardQuery.error) ?? 'Could not load your dashboard.'}
          />
        ) : null}

        {dashboardQuery.isPending ? (
          <div aria-busy>
            <DashboardSkeleton
              selectedSections={preferencesQuery.data?.preferences?.contentTypes}
            />
          </div>
        ) : null}

        {dashboardQuery.data === undefined ? null : (
          <DashboardSections
            dashboard={dashboardQuery.data}
            order={sectionOrder}
            onReorder={setSectionOrder}
          />
        )}
      </div>
    </main>
  );
}
