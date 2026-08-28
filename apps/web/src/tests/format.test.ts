import { describe, expect, it } from 'vitest';

import { formatPercentChange, formatPrice, formatRelativeTime } from '../lib/format.js';

const NOW = Date.parse('2026-08-27T12:00:00.000Z');

describe('formatRelativeTime', () => {
  it('reports anything inside the last minute as just now', () => {
    expect(formatRelativeTime('2026-08-27T11:59:30.000Z', NOW)).toBe('just now');
  });

  it('picks minutes for a recent fetch', () => {
    expect(formatRelativeTime('2026-08-27T11:55:00.000Z', NOW)).toBe('5 minutes ago');
  });

  // The badge must not say "127 minutes ago" when it can say "2 hours ago".
  it('steps up to the coarsest unit that fits', () => {
    expect(formatRelativeTime('2026-08-27T09:53:00.000Z', NOW)).toBe('2 hours ago');
    expect(formatRelativeTime('2026-08-25T12:00:00.000Z', NOW)).toBe('2 days ago');
  });
});

describe('formatPrice', () => {
  it('renders a dollar-scale price with two decimals', () => {
    expect(formatPrice(80_000)).toBe('$80,000.00');
  });

  // Two decimals would render this as $0.00, which reads as worthless.
  it('keeps a sub-dollar price legible', () => {
    expect(formatPrice(0.004521)).toBe('$0.004521');
  });
});

describe('formatPercentChange', () => {
  it('treats the input as whole percentage points, not a fraction', () => {
    expect(formatPercentChange(-4.07)).toBe('-4.07%');
  });

  it('signs a positive change so direction is readable without colour alone', () => {
    expect(formatPercentChange(2.5)).toBe('+2.5%');
  });
});
