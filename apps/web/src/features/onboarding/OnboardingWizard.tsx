import { useState } from 'react';

import type { OnboardingQuestion } from '@aca/shared';

import { Button } from '../../components/Button.js';
import { FormBanner } from '../../components/FormBanner.js';
import { QuestionStep } from '../../components/questions/QuestionStep.js';
import { getFormMessage } from '../../lib/api/form-errors.js';
import {
  createEmptyAnswers,
  isAnswerComplete,
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
 */
export function OnboardingWizard({ questions }: OnboardingWizardProps) {
  const submitMutation = useSavePreferences();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>(createEmptyAnswers);

  const question = questions[stepIndex];
  if (question === undefined) {
    return null;
  }

  const questionId = question.id;
  const isLastStep = stepIndex === questions.length - 1;
  // The final step checks every answer, not just its own: a user can step back
  // and clear an earlier one, and toPreferencesRequest throws on an incomplete set.
  const canContinue = isLastStep
    ? questions.every((item) => isAnswerComplete(item, answers[item.id]))
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
    setStepIndex((current) => current + 1);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm text-slate-500">
          Step {stepIndex + 1} of {questions.length}
        </p>
        <div className="mt-2 h-1 rounded-full bg-slate-800">
          <div
            className="h-1 rounded-full bg-slate-300 transition-all"
            style={{ width: `${String(((stepIndex + 1) / questions.length) * PERCENT)}%` }}
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
        {stepIndex === 0 ? null : (
          <button
            type="button"
            onClick={() => {
              setStepIndex((current) => current - 1);
            }}
            className="min-h-11 flex-1 rounded-lg border border-slate-700 px-4 text-base font-medium text-slate-300"
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
