import type { OnboardingQuestion } from '@aca/shared';

import { MultiSelectQuestion } from './MultiSelectQuestion.js';
import { SingleSelectQuestion } from './SingleSelectQuestion.js';

interface QuestionStepProps {
  question: OnboardingQuestion;
  selected: string[];
  onChange: (values: string[]) => void;
}

/**
 * Renders whichever control the server's question type calls for, and normalises
 * a single answer into the one-element array the wizard stores for every step.
 */
export function QuestionStep({ question, selected, onChange }: QuestionStepProps) {
  if (question.type === 'single-select') {
    return (
      <SingleSelectQuestion
        question={question}
        value={selected[0]}
        onChange={(value) => {
          onChange([value]);
        }}
      />
    );
  }
  return <MultiSelectQuestion question={question} values={selected} onChange={onChange} />;
}
