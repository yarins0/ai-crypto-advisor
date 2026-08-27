import { Navigate } from 'react-router';

import { FormBanner } from '../../components/FormBanner.js';
import { FullPageSpinner } from '../../components/FullPageSpinner.js';
import { getFormMessage } from '../../lib/api/form-errors.js';
import { useSession } from '../auth/use-session.js';
import { OnboardingWizard } from './OnboardingWizard.js';
import { useOnboardingQuestions } from './use-onboarding.js';

export function OnboardingPage() {
  const { data: session } = useSession();
  const questionsQuery = useOnboardingQuestions();

  // Submitting sets onboardedAt, so the refreshed session is what ends this
  // screen. Leaving the exit to a guard keeps one rule for who sees onboarding,
  // and covers an already-onboarded user opening the URL directly.
  if (session?.user.onboardedAt) {
    return <Navigate to="/" replace />;
  }

  if (questionsQuery.isPending) {
    return <FullPageSpinner />;
  }

  if (questionsQuery.isError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 sm:px-6">
        <FormBanner
          message={getFormMessage(questionsQuery.error) ?? 'Could not load the questions.'}
        />
      </main>
    );
  }

  return <OnboardingWizard questions={questionsQuery.data.questions} />;
}
