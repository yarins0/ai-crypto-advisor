import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Centred single-column shell for the signed-out screens. The form sits on a
 * raised card so it reads as an object on the canvas rather than loose text.
 * min-h-dvh rather than
 * min-h-screen: mobile browsers report 100vh as taller than the visible area,
 * which pushes a vertically centred form under the address bar.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-sm motion-safe:animate-rise-in">
        <p className="text-sm font-medium text-ink-faint">AI Crypto Advisor</p>
        <div className="mt-3 rounded-xl border border-line bg-surface p-6 shadow-raised">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>
      </div>
    </main>
  );
}
