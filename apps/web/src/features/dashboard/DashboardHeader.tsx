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
        <p className="text-sm text-slate-500">AI Crypto Advisor</p>
        <p className="truncate text-lg font-semibold text-slate-100">{session?.user.name}</p>
      </div>
      <nav className="flex shrink-0 items-center gap-2">
        <Link
          to="/settings"
          className="flex min-h-11 items-center rounded-lg border border-slate-700 px-3 text-sm font-medium text-slate-300"
        >
          Preferences
        </Link>
        <button
          type="button"
          disabled={logoutMutation.isPending}
          onClick={() => {
            logoutMutation.mutate();
          }}
          className="min-h-11 rounded-lg border border-slate-700 px-3 text-sm font-medium text-slate-300 disabled:opacity-60"
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}
