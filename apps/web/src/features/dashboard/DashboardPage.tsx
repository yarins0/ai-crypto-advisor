import { FormBanner } from '../../components/FormBanner.js';
import { getFormMessage } from '../../lib/api/form-errors.js';
import { usePreferences } from '../preferences/use-preferences.js';
import { DashboardHeader } from './DashboardHeader.js';
import { DashboardSections } from './DashboardSections.js';
import { DashboardSkeleton } from './DashboardSkeleton.js';
import { useDashboard } from './use-dashboard.js';

/**
 * The layout lives here rather than in DashboardSections so the placeholder and
 * the real cards cannot be laid out differently, which is the whole point of
 * showing a placeholder. Two columns only from `lg`; a phone stays single file.
 *
 * A lone card skips `card-columns`: CSS multi-column sizes a single child to
 * one column's width but still leaves dead space beside it, since nothing
 * flows in to fill the second column. `card-single` keeps that same width
 * without the split, so a page that had one card before still looks like it.
 */
function getSectionLayoutClass(sectionCount: number | undefined): string {
  return sectionCount === 1 ? 'card-stagger card-single' : 'card-stagger card-columns';
}

export function DashboardPage() {
  const dashboardQuery = useDashboard();
  // Fetched alongside the dashboard rather than in front of it: this only sizes
  // the placeholder, so gating the real paint on it would spend load time to
  // improve a loading state.
  const preferencesQuery = usePreferences();

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
          <div
            aria-busy
            className={getSectionLayoutClass(
              preferencesQuery.data?.preferences?.contentTypes.length,
            )}
          >
            <DashboardSkeleton
              selectedSections={preferencesQuery.data?.preferences?.contentTypes}
            />
          </div>
        ) : null}

        {dashboardQuery.data === undefined ? null : (
          <div
            className={getSectionLayoutClass(
              Object.values(dashboardQuery.data.sections).filter((section) => section !== null)
                .length,
            )}
          >
            <DashboardSections dashboard={dashboardQuery.data} />
          </div>
        )}
      </div>
    </main>
  );
}
