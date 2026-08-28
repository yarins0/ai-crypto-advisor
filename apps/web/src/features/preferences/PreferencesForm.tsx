import { useState } from 'react';
import type { FormEvent } from 'react';

import type { OnboardingQuestion } from '@aca/shared';

import { Button } from '../../components/Button.js';
import { Dialog } from '../../components/Dialog.js';
import { FormBanner } from '../../components/FormBanner.js';
import { QuestionStep } from '../../components/questions/QuestionStep.js';
import { getFormMessage } from '../../lib/api/form-errors.js';
import { isAnswerComplete, selectAskableQuestions, toPreferencesRequest } from './answers.js';
import type { AnswerMap } from './answers.js';
import { selectVisibleGroups, summarisePreferenceGroup } from './preference-groups.js';
import type { PreferenceGroup } from './preference-groups.js';
import { useSavePreferences } from './use-preferences.js';

interface PreferencesFormProps {
  questions: OnboardingQuestion[];
  initialAnswers: AnswerMap;
}

/**
 * A summary row per group, each opening a dialog holding only that group's
 * questions. The alternative — every question stacked on one screen — put
 * fifteen coins in a single column above the two answers most people came to
 * change, and the length was the reason those two were hard to reach.
 *
 * Edits land in local state and one Save persists them all. Saving per dialog
 * would bump the preference version once per group, and that version is what
 * votes in flight are checked against, so each extra bump is an extra 409.
 *
 * Taking the loaded answers as a prop lets useState seed from them directly,
 * which avoids syncing server data into local state with an effect.
 */
export function PreferencesForm({ questions, initialAnswers }: PreferencesFormProps) {
  const saveMutation = useSavePreferences();
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  // The visible set follows the answers as they change, so turning the AI
  // insight back on brings its tuning group with it in the same render.
  const askableQuestions = selectAskableQuestions(questions, answers);
  const visibleGroups = selectVisibleGroups(askableQuestions.map((question) => question.id));
  const canSave = askableQuestions.every((question) =>
    isAnswerComplete(question, answers[question.id]),
  );
  const hasUnsavedEdits = JSON.stringify(answers) !== JSON.stringify(initialAnswers);
  const formMessage = getFormMessage(saveMutation.error);

  function questionsInGroup(group: PreferenceGroup): OnboardingQuestion[] {
    return askableQuestions.filter((question) => group.questionIds.includes(question.id));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveMutation.mutate(toPreferencesRequest(answers));
  }

  return (
    <>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
        <ul className="flex flex-col gap-3">
          {visibleGroups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => {
                  setOpenGroupId(group.id);
                }}
                className="surface-card flex min-h-11 w-full items-center gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3 text-left shadow-raised transition-colors duration-200 hover:border-line-strong"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{group.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-faint">
                    {summarisePreferenceGroup(group, questions, answers)}
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-ink-faint">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>

        {formMessage === null ? null : <FormBanner message={formMessage} />}

        <div className="flex flex-col gap-2">
          <Button type="submit" isPending={saveMutation.isPending} isDisabled={!canSave}>
            Save preferences
          </Button>
          {/* Edits made inside a dialog leave no trace on the page once it
              closes, so the pending state has to be said out loud. */}
          {hasUnsavedEdits ? (
            <p className="text-center text-sm text-ink-faint">You have unsaved changes.</p>
          ) : null}
          {saveMutation.isSuccess && !hasUnsavedEdits ? (
            <p role="status" className="text-center text-sm text-ink-muted">
              Preferences saved.
            </p>
          ) : null}
        </div>
      </form>

      {visibleGroups.map((group) => (
        <Dialog
          key={group.id}
          isOpen={openGroupId === group.id}
          title={group.label}
          onClose={() => {
            setOpenGroupId(null);
          }}
        >
          <p className="text-sm text-ink-muted">{group.description}</p>
          <div className="mt-5 flex flex-col gap-8">
            {questionsInGroup(group).map((question, _position, groupQuestions) => (
              <QuestionStep
                key={question.id}
                question={question}
                // A group holding one question is already named by the dialog
                // title, so repeating the label is noise; a group holding two
                // needs them to tell its questions apart.
                isLabelHidden={groupQuestions.length === 1}
                selected={answers[question.id]}
                onChange={(values) => {
                  setAnswers((current) => ({ ...current, [question.id]: values }));
                }}
              />
            ))}
          </div>
        </Dialog>
      ))}
    </>
  );
}
