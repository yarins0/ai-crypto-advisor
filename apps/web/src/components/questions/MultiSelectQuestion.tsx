import type { OnboardingQuestion } from '@aca/shared';

import { getOptionRowClass } from './option-styles.js';

interface MultiSelectQuestionProps {
  question: OnboardingQuestion;
  values: string[];
  onChange: (values: string[]) => void;
}

function buildSelectionHint(question: OnboardingQuestion, selectedCount: number): string {
  if (question.max === undefined) {
    return `${String(selectedCount)} selected`;
  }
  return `${String(selectedCount)} of ${String(question.max)} selected`;
}

export function MultiSelectQuestion({ question, values, onChange }: MultiSelectQuestionProps) {
  const isAtMaximum = question.max !== undefined && values.length >= question.max;

  function handleToggle(optionValue: string): void {
    const isSelected = values.includes(optionValue);
    onChange(
      isSelected ? values.filter((value) => value !== optionValue) : [...values, optionValue],
    );
  }

  return (
    <fieldset className="border-0 p-0">
      <legend className="text-lg font-semibold text-ink">{question.label}</legend>
      <p className="mt-1 text-sm text-ink-muted">{buildSelectionHint(question, values.length)}</p>
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
                className="size-4 shrink-0 accent-accent"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
