import { useState } from 'react';

import type { OnboardingQuestion } from '@aca/shared';

import { Button } from '../../components/Button.js';
import { FormBanner } from '../../components/FormBanner.js';
import { QuestionStep } from '../../components/questions/QuestionStep.js';
import { getFormMessage } from '../../lib/api/form-errors.js';
import {
  createEmptyAnswers,
  isAnswerComplete,
  selectAskableQuestions,
  toPreferencesRequest,
} from '../preferences/answers.js';
import type { AnswerMap } from '../preferences/answers.js';
import { useSavePreferences } from '../preferences/use-preferences.js';

const PERCENT = 100;

interface OnboardingWizardProps {
  questions: OnboardingQuestion[];
}

/**
 * One question per screen rather than a single long form: the assets question
 * alone lists fifteen options, which on a phone is most of a scroll on its own.
 *
 * The step list is derived from the answers rather than fixed, so choosing no
 * AI insight leaves two questions instead of four.
 */
export function OnboardingWizard({ questions }: OnboardingWizardProps) {
  const submitMutation = useSavePreferences();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>(createEmptyAnswers);

  const askableQuestions = selectAskableQuestions(questions, answers);
  // Dropping the insight section shortens the list underneath a later index, so
  // the step is clamped rather than rendering an empty screen.
  const safeStepIndex = Math.min(stepIndex, askableQuestions.length - 1);
  const question = askableQuestions[safeStepIndex];
  if (question === undefined) {
    return null;
  }

  const questionId = question.id;
  const isLastStep = safeStepIndex === askableQuestions.length - 1;
  // The final step checks every answer, not just its own: a user can step back
  // and clear an earlier one, and toPreferencesRequest throws on an incomplete set.
  const canContinue = isLastStep
    ? askableQuestions.every((item) => isAnswerComplete(item, answers[item.id]))
    : isAnswerComplete(question, answers[questionId]);
  const formMessage = getFormMessage(submitMutation.error);

  function handleChange(values: string[]): void {
    setAnswers((current) => ({ ...current, [questionId]: values }));
  }

  function handleContinue(): void {
    if (isLastStep) {
      submitMutation.mutate(toPreferencesRequest(answers));
      return;
    }
    setStepIndex(safeStepIndex + 1);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:px-6">
      <header>
        {/* role="status" so the step change is announced: clicking Continue or
            Back re-renders this text in place, which a screen reader would
            otherwise never notice since focus stays on the button below. */}
        <p role="status" className="text-sm text-ink-faint">
          Step {safeStepIndex + 1} of {askableQuestions.length}
        </p>
        <div className="mt-2 h-1 rounded-full bg-line">
          <div
            className="h-1 rounded-full bg-accent transition-all"
            style={{
              width: `${String(((safeStepIndex + 1) / askableQuestions.length) * PERCENT)}%`,
            }}
          />
        </div>
      </header>

      <div className="mt-8 flex-1">
        <QuestionStep question={question} selected={answers[questionId]} onChange={handleChange} />
      </div>

      {formMessage === null ? null : (
        <div className="mt-6">
          <FormBanner message={formMessage} />
        </div>
      )}

      <div className="mt-8 flex gap-3">
        {safeStepIndex === 0 ? null : (
          <button
            type="button"
            onClick={() => {
              setStepIndex(safeStepIndex - 1);
            }}
            className="min-h-11 flex-1 rounded-md border border-line-strong px-4 text-base font-medium text-ink-muted"
          >
            Back
          </button>
        )}
        <div className="flex-1">
          <Button
            type="button"
            isPending={submitMutation.isPending}
            isDisabled={!canContinue}
            onClick={handleContinue}
          >
            {isLastStep ? 'Finish' : 'Continue'}
          </Button>
        </div>
      </div>
    </main>
  );
}
