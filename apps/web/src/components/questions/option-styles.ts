const BASE_OPTION_ROW =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-base';

/** Shared so a radio row and a checkbox row cannot drift apart visually. */
export function getOptionRowClass(isSelected: boolean, isDisabled = false): string {
  const stateClass = isSelected
    ? 'border-accent bg-surface-raised text-ink'
    : 'border-line text-ink-muted';
  const disabledClass = isDisabled ? ' cursor-not-allowed opacity-40' : '';
  return `${BASE_OPTION_ROW} ${stateClass}${disabledClass}`;
}
