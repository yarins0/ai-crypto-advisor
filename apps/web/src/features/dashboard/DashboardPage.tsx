import { CardSkeleton } from '../../components/CardSkeleton.js';
import { FormBanner } from '../../components/FormBanner.js';
import { getFormMessage } from '../../lib/api/form-errors.js';
import { DashboardHeader } from './DashboardHeader.js';
import { DashboardSections } from './DashboardSections.js';
import { useDashboard } from './use-dashboard.js';

/**
 * Rows per placeholder card, at the sizes the four sections usually resolve to.
 * All four are drawn even though a user may have selected fewer: which sections
 * exist is only known from the response this is waiting on. Prefetching
 * preferences would size it exactly, at the cost of a second blocking request.
 */
const SKELETON_ROW_COUNTS = [5, 3, 4, 1];

/**
 * The layout lives here rather than in DashboardSections so the placeholder and
 * the real cards cannot be laid out differently, which is the whole point of
 * showing a placeholder. Two columns only from `lg`; a phone stays single file.
 */
const SECTION_LAYOUT_CLASS = 'card-stagger card-columns';

export function DashboardPage() {
  const dashboardQuery = useDashboard();

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
          <div aria-busy className={SECTION_LAYOUT_CLASS}>
            {/* The skeleton itself is hidden from assistive tech, so the loading
                state is carried by this status region instead. */}
            <p role="status" className="sr-only">
              Loading your dashboard…
            </p>
            {SKELETON_ROW_COUNTS.map((rowCount, cardPosition) => (
              <CardSkeleton key={cardPosition} rowCount={rowCount} />
            ))}
          </div>
        ) : null}

        {dashboardQuery.data === undefined ? null : (
          <div className={SECTION_LAYOUT_CLASS}>
            <DashboardSections dashboard={dashboardQuery.data} />
          </div>
        )}
      </div>
    </main>
  );
}
