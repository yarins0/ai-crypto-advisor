import { Link } from 'react-router';

import { useLogout, useSession } from '../auth/use-session.js';

export function DashboardHeader() {
  const { data: session } = useSession();
  const logoutMutation = useLogout();

  return (
    // Stacks on a phone and only becomes a row once there is width for one,
    // so the name never competes with the actions for the same line.
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
          AI Crypto Advisor
        </p>
        <p className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">
          {session?.user.name}
        </p>
      </div>
      <nav className="flex shrink-0 items-center gap-2">
        <Link
          to="/settings"
          className="flex min-h-11 items-center rounded-md border border-line-strong px-3 text-sm font-medium text-ink-muted"
        >
          Preferences
        </Link>
        <button
          type="button"
          disabled={logoutMutation.isPending}
          onClick={() => {
            logoutMutation.mutate();
          }}
          className="min-h-11 rounded-md border border-line-strong px-3 text-sm font-medium text-ink-muted disabled:opacity-60"
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}
