import { FormBanner } from '../../components/FormBanner.js';
import { getFormMessage } from '../../lib/api/form-errors.js';
import { DashboardHeader } from './DashboardHeader.js';
import { DashboardSections } from './DashboardSections.js';
import { useDashboard } from './use-dashboard.js';

export function DashboardPage() {
  const dashboardQuery = useDashboard();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Rendered above the query states so a failed dashboard still leaves the
          user a way to reach their preferences or sign out. */}
      <DashboardHeader />

      <div className="mt-6">
        {dashboardQuery.isPending ? (
          <p className="text-sm text-slate-500">Loading your dashboard…</p>
        ) : null}

        {dashboardQuery.isError ? (
          <FormBanner
            message={getFormMessage(dashboardQuery.error) ?? 'Could not load your dashboard.'}
          />
        ) : null}

        {dashboardQuery.data === undefined ? null : (
          <DashboardSections dashboard={dashboardQuery.data} />
        )}
      </div>
    </main>
  );
}
