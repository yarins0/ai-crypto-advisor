import { Suspense, lazy } from 'react';

interface SparklineProps {
  points: number[];
  priceChangePercentage24h: number | null;
}

/** A line needs two points; one or none is a flat artefact rather than a trend. */
const MINIMUM_POINTS = 2;

/**
 * Recharts costs roughly 83 kB gzipped, so it is fetched only once a chart is
 * actually drawn. `lazy` resolves a default export, which the named one is
 * adapted to here rather than making this the codebase's only default export.
 */
const SparklineChart = lazy(() =>
  import('./SparklineChart.js').then((module) => ({ default: module.SparklineChart })),
);

/**
 * Tailwind resolves these to the palette's oklch tokens, and the chart stroke
 * inherits them through `currentColor`, so the chart cannot drift from the theme.
 */
export function getSparklineColorClass(priceChangePercentage24h: number | null): string {
  if (priceChangePercentage24h === null) {
    return 'text-ink-faint';
  }
  return priceChangePercentage24h >= 0 ? 'text-up' : 'text-down';
}

/**
 * The live feed returns 168 hourly points and the committed fallbacks return 7,
 * so the series length is not something a caller can rely on.
 */
export function Sparkline({ points, priceChangePercentage24h }: SparklineProps) {
  const hasTrend = points.length >= MINIMUM_POINTS;

  return (
    // aria-hidden because the price and 24h change beside it state the same
    // trend as text; announcing the chart would only repeat them.
    <div aria-hidden className={`h-5 w-full ${getSparklineColorClass(priceChangePercentage24h)}`}>
      {/* Height is reserved here rather than in the chart so the row holds its
          layout while the chunk loads. Width comes from the caller, which needs a
          different one per breakpoint. A series too short to draw never requests it. */}
      {hasTrend ? (
        <Suspense fallback={null}>
          <SparklineChart points={points} />
        </Suspense>
      ) : null}
    </div>
  );
}
