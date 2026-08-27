import type { ReactNode } from 'react';

import type { ContentSource } from '@aca/shared';

import { StaleBadge } from './StaleBadge.js';

interface CardProps {
  title: string;
  source: ContentSource;
  fetchedAt: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Card({ title, source, fetchedAt, action, children }: CardProps) {
  return (
    <section className="rounded-md border border-line bg-surface-raised p-4">
      {/* Wraps rather than compressing: on a narrow screen the staleness badge
          drops to its own line instead of squeezing the title to a few glyphs. */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{title}</h2>
        <StaleBadge source={source} fetchedAt={fetchedAt} />
        {action === undefined ? null : <div className="ml-auto">{action}</div>}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}
