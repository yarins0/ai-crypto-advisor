import { Link } from 'react-router';

import { FormBanner } from '../../components/FormBanner.js';
import { FullPageSpinner } from '../../components/FullPageSpinner.js';
import { useOnboardingQuestions } from '../onboarding/use-onboarding.js';
import { PreferencesForm } from './PreferencesForm.js';
import { toAnswerMap } from './answers.js';
import { usePreferences } from './use-preferences.js';

export function SettingsPage() {
  const questionsQuery = useOnboardingQuestions();
  const preferencesQuery = usePreferences();

  const isPending = questionsQuery.isPending || preferencesQuery.isPending;
  const error = questionsQuery.error ?? preferencesQuery.error;
  const preferences = preferencesQuery.data?.preferences ?? null;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <Link to="/" className="text-sm text-ink-muted underline-offset-2 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Preferences</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Editing these rebuilds your dashboard and starts a new preference version.
        </p>
      </header>

      <div className="mt-8">
        {isPending ? <FullPageSpinner /> : null}

        {error === null ? null : <FormBanner message="Could not load your preferences." />}

        {questionsQuery.data === undefined || preferences === null ? null : (
          <PreferencesForm
            questions={questionsQuery.data.questions}
            initialAnswers={toAnswerMap(preferences)}
          />
        )}
      </div>
    </main>
  );
}
