import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Centred single-column shell for the signed-out screens. min-h-dvh rather than
 * min-h-screen: mobile browsers report 100vh as taller than the visible area,
 * which pushes a vertically centred form under the address bar.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-sm">
        <p className="text-sm font-medium text-slate-500">AI Crypto Advisor</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-6 text-center text-sm text-slate-400">{footer}</p>
      </div>
    </main>
  );
}
