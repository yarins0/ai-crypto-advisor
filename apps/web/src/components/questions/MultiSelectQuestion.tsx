import type { OnboardingQuestion } from '@aca/shared';

import { getOptionRowClass } from './option-styles.js';

interface MultiSelectQuestionProps {
  question: OnboardingQuestion;
  values: string[];
  onChange: (values: string[]) => void;
  /** Set where a surrounding title already names the question. */
  isLabelHidden?: boolean;
}

function buildSelectionHint(question: OnboardingQuestion, selectedCount: number): string {
  if (question.max === undefined) {
    return `${String(selectedCount)} selected`;
  }
  return `${String(selectedCount)} of ${String(question.max)} selected`;
}

export function MultiSelectQuestion({
  question,
  values,
  onChange,
  isLabelHidden = false,
}: MultiSelectQuestionProps) {
  const isAtMaximum = question.max !== undefined && values.length >= question.max;
  // Capped at max, not just options.length: "select all" must never propose a
  // selection the shared schema would reject if max is ever below the option count.
  const selectAllTarget = question.options
    .map((option) => option.value)
    .slice(0, question.max ?? question.options.length);
  const isEverythingSelected = values.length === selectAllTarget.length;

  function handleToggle(optionValue: string): void {
    const isSelected = values.includes(optionValue);
    onChange(
      isSelected ? values.filter((value) => value !== optionValue) : [...values, optionValue],
    );
  }

  function handleToggleAll(): void {
    onChange(isEverythingSelected ? [] : selectAllTarget);
  }

  return (
    <fieldset className="border-0 p-0">
      <legend className={isLabelHidden ? 'sr-only' : 'text-lg font-semibold text-ink'}>
        {question.label}
      </legend>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{buildSelectionHint(question, values.length)}</p>
        <button
          type="button"
          onClick={handleToggleAll}
          className="text-sm font-medium text-accent underline-offset-2 hover:underline"
        >
          {isEverythingSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {question.options.map((option) => {
          const isSelected = values.includes(option.value);
          // Blocking further selection at the cap keeps the limit visible in the
          // UI rather than surfacing later as a 400 from the shared schema.
          const isDisabled = isAtMaximum && !isSelected;
          return (
            <label key={option.value} className={getOptionRowClass(isSelected, isDisabled)}>
              <input
                type="checkbox"
                name={question.id}
                value={option.value}
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => {
                  handleToggle(option.value);
                }}
                // The icon carries the checked state visually when there is one, so
                // the native box would just be a second, redundant indicator.
                className={
                  option.image === undefined ? 'size-4 shrink-0 accent-accent' : 'peer sr-only'
                }
              />
              {option.image === undefined ? null : (
                <span className="relative shrink-0 rounded-full peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                  <img src={option.image} alt="" className="size-6 rounded-full" />
                  {isSelected && (
                    // Dark scrim under a light check: legible against a logo of any
                    // color, unlike a fixed light/dark pairing keyed to the theme.
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-canvas/70">
                      <svg viewBox="0 0 24 24" fill="none" className="size-3.5 text-ink">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="currentColor"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </span>
              )}
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
