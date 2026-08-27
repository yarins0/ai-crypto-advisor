import type { OnboardingQuestion } from '@aca/shared';

import { getOptionRowClass } from './option-styles.js';

interface SingleSelectQuestionProps {
  question: OnboardingQuestion;
  value: string | undefined;
  onChange: (value: string) => void;
}

export function SingleSelectQuestion({ question, value, onChange }: SingleSelectQuestionProps) {
  return (
    // fieldset/legend rather than a div and a heading: it is what groups the
    // radios for a screen reader, so the question is read with each option.
    <fieldset className="border-0 p-0">
      <legend className="text-lg font-semibold text-slate-100">{question.label}</legend>
      <div className="mt-4 flex flex-col gap-2">
        {question.options.map((option) => (
          <label key={option.value} className={getOptionRowClass(value === option.value)}>
            <input
              type="radio"
              name={question.id}
              value={option.value}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
              className="size-4 shrink-0 accent-slate-200"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
