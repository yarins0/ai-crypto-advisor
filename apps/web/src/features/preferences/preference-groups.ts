import type { OnboardingQuestion } from '@aca/shared';

import type { AnswerMap } from './answers.js';

export interface PreferenceGroup {
  id: string;
  label: string;
  description: string;
  questionIds: OnboardingQuestion['id'][];
}

/**
 * The editing unit on the settings screen. Grouping is by what an answer governs
 * rather than by which card displays it: assets feed both prices and news, so a
 * per-card split would have to keep one answer in two places.
 */
export const PREFERENCE_GROUPS: PreferenceGroup[] = [
  {
    id: 'sections',
    label: 'Dashboard sections',
    description: 'Which cards your dashboard is built from.',
    questionIds: ['contentTypes'],
  },
  {
    id: 'coins',
    label: 'Coins',
    description: 'Tracked across prices and news.',
    questionIds: ['assets'],
  },
  {
    id: 'tuning',
    label: 'Insight tuning',
    description: 'Shapes the daily AI insight.',
    questionIds: ['investorType', 'riskTolerance'],
  },
];

const EMPTY_SUMMARY = 'None selected';

/**
 * Reads back the chosen option labels rather than a count, so a row says what
 * is set without being opened. The server owns the labels, so a renamed option
 * cannot leave the summary describing something the dialog no longer offers.
 */
export function summarisePreferenceGroup(
  group: PreferenceGroup,
  questions: OnboardingQuestion[],
  answers: AnswerMap,
): string {
  const labels = group.questionIds.flatMap((questionId) => {
    const question = questions.find((item) => item.id === questionId);
    if (question === undefined) {
      return [];
    }
    return question.options
      .filter((option) => answers[questionId].includes(option.value))
      .map((option) => option.label);
  });

  return labels.length === 0 ? EMPTY_SUMMARY : labels.join(', ');
}

/** Groups with nothing left to ask are dropped rather than shown empty. */
export function selectVisibleGroups(
  askableQuestionIds: OnboardingQuestion['id'][],
): PreferenceGroup[] {
  return PREFERENCE_GROUPS.filter((group) =>
    group.questionIds.some((questionId) => askableQuestionIds.includes(questionId)),
  );
}
