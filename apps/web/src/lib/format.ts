const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const PERCENTAGE_POINTS_PER_UNIT = 100;
const SUB_DOLLAR_THRESHOLD = 1;

const MINUTE_MS = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const HOUR_MS = MINUTES_PER_HOUR * MINUTE_MS;
const DAY_MS = HOURS_PER_DAY * HOUR_MS;

const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['day', DAY_MS],
  ['hour', HOUR_MS],
  ['minute', MINUTE_MS],
];

/**
 * Pinned because the runtime default follows the browser's UI language rather
 * than `<html lang>`: a Hebrew-locale Chrome rendered prices with a trailing
 * dollar sign and every timestamp in Hebrew inside an untranslated page.
 */
const DISPLAY_LOCALE = 'en-US';

// Formatters are expensive to construct and are rebuilt on every render if
// created inline, so each is made once at module scope.
const relativeTimeFormatter = new Intl.RelativeTimeFormat(DISPLAY_LOCALE, { numeric: 'auto' });

const dollarFormatter = new Intl.NumberFormat(DISPLAY_LOCALE, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const subDollarFormatter = new Intl.NumberFormat(DISPLAY_LOCALE, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 6,
});

const percentFormatter = new Intl.NumberFormat(DISPLAY_LOCALE, {
  style: 'percent',
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

/** Coarsest unit that fits, so a staleness badge reads "2 hours ago", not "127 minutes ago". */
export function formatRelativeTime(isoTimestamp: string, now: number = Date.now()): string {
  const elapsedMs = new Date(isoTimestamp).getTime() - now;
  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(elapsedMs) >= unitMs) {
      return relativeTimeFormatter.format(Math.round(elapsedMs / unitMs), unit);
    }
  }
  return 'just now';
}

/**
 * Curated assets span roughly $0.30 to $80,000, and two decimal places render a
 * sub-dollar coin as $0.00 — indistinguishable from worthless.
 */
export function formatPrice(value: number): string {
  return value >= SUB_DOLLAR_THRESHOLD
    ? dollarFormatter.format(value)
    : subDollarFormatter.format(value);
}

/** CoinGecko reports whole percentage points, where Intl's percent style expects a fraction. */
export function formatPercentChange(percentagePoints: number): string {
  return percentFormatter.format(percentagePoints / PERCENTAGE_POINTS_PER_UNIT);
}

/**
 * Model ids arrive namespaced by their host ('meta-llama/Llama-3.1-8B-Instruct').
 * The vendor prefix is routing detail, and the reader only needs to know which
 * model wrote the text they are being asked to trust.
 */
export function formatModelName(modelId: string): string {
  const withoutVendor = modelId.includes('/')
    ? modelId.slice(modelId.lastIndexOf('/') + 1)
    : modelId;
  return withoutVendor.replaceAll('-', ' ');
}
