interface CardSkeletonProps {
  rowCount: number;
}

/**
 * Placeholder matching the real card's frame and row rhythm, so the layout does
 * not shift when the dashboard resolves. Hidden from assistive tech: the loading
 * state is announced once by the status region around it, not by every bar.
 */
export function CardSkeleton({ rowCount }: CardSkeletonProps) {
  return (
    <div
      aria-hidden
      className="rounded-xl border border-line surface-card bg-surface-raised p-4 shadow-raised"
    >
      <div className="h-3 w-20 rounded-sm bg-line motion-safe:animate-pulse" />
      <div className="mt-4 flex flex-col gap-3">
        {[...Array(rowCount).keys()].map((rowPosition) => (
          <div key={rowPosition} className="h-8 rounded-sm bg-line motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
