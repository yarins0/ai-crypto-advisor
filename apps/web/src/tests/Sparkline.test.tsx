import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sparkline, getSparklineColorClass } from '../components/Sparkline.js';

// Deliberately under vitest's 5s testTimeout: the two ceilings race, and the
// test's own timeout preempts the wait, discarding the assertion error that is
// the only output naming why no chart arrived.
const CHART_WAIT_MS = 3000;

// Matches the shape of a committed fallback series, the shortest the API returns.
const FALLBACK_SERIES = [80_100, 79_600, 79_900, 78_800, 79_200, 78_400, 78_000];

function renderSparkline(points: number[]): HTMLElement {
  const { container } = render(<Sparkline points={points} priceChangePercentage24h={1.5} />);
  return container;
}

function chartIn(container: HTMLElement): SVGElement | null {
  return container.querySelector('svg');
}

describe('getSparklineColorClass', () => {
  it('reads flat when the 24h change is unknown rather than implying a direction', () => {
    expect(getSparklineColorClass(null)).toBe('text-ink-faint');
  });

  // Zero is not a fall, so the boundary belongs on the up side.
  it('treats an unchanged price as up', () => {
    expect(getSparklineColorClass(0)).toBe('text-up');
  });

  it('separates a rising series from a falling one', () => {
    expect(getSparklineColorClass(4.2)).toBe('text-up');
    expect(getSparklineColorClass(-4.2)).toBe('text-down');
  });
});

describe('Sparkline', () => {
  // The chart arrives on its own chunk, so the series is drawn a tick after mount.
  it('draws the seven-point series the fallbacks return', async () => {
    // Warmed first so the assertion races only React's re-render, not Vite
    // transforming recharts and its d3 tree on demand.
    await import('../components/SparklineChart.js');
    const container = renderSparkline(FALLBACK_SERIES);

    // A failure here has been seen to burn the whole budget, so it is a hang
    // rather than a delay. Asserting on the markup makes it name its own cause:
    // a container held at zero width, or a chunk that never resolved.
    await waitFor(
      () => {
        expect(container.innerHTML).toContain('<svg');
      },
      { timeout: CHART_WAIT_MS },
    );
  });

  // The length guard runs before the lazy boundary, so a series this short never
  // resolves a chart and the assertion needs no waiting.
  it('draws nothing for a series too short to form a line', () => {
    expect(chartIn(renderSparkline([]))).toBeNull();
    expect(chartIn(renderSparkline([79_000]))).toBeNull();
  });

  it('keeps its footprint before the chart loads, so the row cannot reflow', () => {
    const empty = renderSparkline([]).firstElementChild;
    const pending = renderSparkline(FALLBACK_SERIES).firstElementChild;

    expect(empty?.className).toBe(pending?.className);
  });
});
