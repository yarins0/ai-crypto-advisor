import { useState } from 'react';
import type { FormEvent } from 'react';

import type { OnboardingQuestion } from '@aca/shared';

import { Button } from '../../components/Button.js';
import { FormBanner } from '../../components/FormBanner.js';
import { QuestionStep } from '../../components/questions/QuestionStep.js';
import { getFormMessage } from '../../lib/api/form-errors.js';
import { isAnswerComplete, toPreferencesRequest } from './answers.js';
import type { AnswerMap } from './answers.js';
import { useSavePreferences } from './use-preferences.js';

interface PreferencesFormProps {
  questions: OnboardingQuestion[];
  initialAnswers: AnswerMap;
}

/**
 * Every question on one screen, unlike the onboarding wizard's one-per-step:
 * someone editing already knows which answer they came to change, and stepping
 * through three they do not care about to reach it is friction, not guidance.
 *
 * Taking the loaded answers as a prop lets useState seed from them directly,
 * which avoids syncing server data into local state with an effect.
 */
export function PreferencesForm({ questions, initialAnswers }: PreferencesFormProps) {
  const saveMutation = useSavePreferences();
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);

  const canSave = questions.every((question) => isAnswerComplete(question, answers[question.id]));
  const formMessage = getFormMessage(saveMutation.error);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveMutation.mutate(toPreferencesRequest(answers));
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-8">
      {questions.map((question) => (
        <QuestionStep
          key={question.id}
          question={question}
          selected={answers[question.id]}
          onChange={(values) => {
            setAnswers((current) => ({ ...current, [question.id]: values }));
          }}
        />
      ))}

      {formMessage === null ? null : <FormBanner message={formMessage} />}

      <div className="flex flex-col gap-2">
        <Button type="submit" isPending={saveMutation.isPending} isDisabled={!canSave}>
          Save preferences
        </Button>
        {saveMutation.isSuccess ? (
          <p role="status" className="text-center text-sm text-ink-muted">
            Preferences saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
