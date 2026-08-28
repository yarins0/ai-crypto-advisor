import { useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineChartProps {
  points: number[];
}

const STROKE_WIDTH_PX = 1.5;

// Vertical room for the stroke, which would otherwise clip at the series extremes.
const CHART_MARGIN = { top: 2, right: 0, bottom: 2, left: 0 } as const;

/**
 * Split from Sparkline so Recharts and its d3 dependencies stay out of the
 * initial bundle; this module is the only thing that imports them.
 *
 * Sized from its container rather than in pixels: the row gives the chart a
 * narrow slot beside the figures on a desktop and the full row width on a
 * phone, and a fixed width drew the same short line into both.
 */
export function SparklineChart({ points }: SparklineChartProps) {
  const series = useMemo(() => points.map((price) => ({ price })), [points]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={series} margin={CHART_MARGIN}>
        {/* Recharts defaults the y domain to [0, dataMax], and a week of prices
            spans a sliver of a coin's absolute value, so a zero-based axis drew
            every series as a flat line. Hidden: the row states the figures. */}
        <YAxis hide domain={['dataMin', 'dataMax']} />
        {/* Animation across fifteen simultaneous charts is visible jank, and the
            series does not change between renders, so there is nothing to animate. */}
        <Line
          dataKey="price"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH_PX}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
