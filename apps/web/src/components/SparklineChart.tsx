import { useMemo } from 'react';
import { Line, LineChart } from 'recharts';

interface SparklineChartProps {
  points: number[];
}

// Matches the box Sparkline reserves, so the chart cannot overflow a row it
// was laid out around while its chunk was still loading.
const WIDTH_PX = 64;
const HEIGHT_PX = 20;

const STROKE_WIDTH_PX = 1.5;

// Vertical room for the stroke, which would otherwise clip at the series extremes.
const CHART_MARGIN = { top: 2, right: 0, bottom: 2, left: 0 } as const;

/**
 * Split from Sparkline so Recharts and its d3 dependencies stay out of the
 * initial bundle; this module is the only thing that imports them.
 */
export function SparklineChart({ points }: SparklineChartProps) {
  const series = useMemo(() => points.map((price) => ({ price })), [points]);

  return (
    <LineChart width={WIDTH_PX} height={HEIGHT_PX} data={series} margin={CHART_MARGIN}>
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
  );
}
