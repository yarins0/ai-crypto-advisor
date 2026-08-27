import { useLogout, useSession } from '../auth/use-session.js';

// Placeholder shell. The four composed sections and the vote controls land in
// the dashboard step; this exists so the signed-in route resolves.
export function DashboardPage() {
  const { data: session } = useSession();
  const logoutMutation = useLogout();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-8 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Signed in as</p>
          <p className="text-base font-medium text-slate-100">{session?.user.name}</p>
        </div>
        <button
          type="button"
          disabled={logoutMutation.isPending}
          onClick={() => {
            logoutMutation.mutate();
          }}
          className="min-h-11 shrink-0 rounded-lg border border-slate-700 px-3 text-sm font-medium text-slate-300 disabled:opacity-60"
        >
          Sign out
        </button>
      </header>
      <p className="mt-8 text-slate-400">Your dashboard sections arrive in the next step.</p>
    </main>
  );
}
