import { preferencesRequestSchema } from '@aca/shared';
import type { OnboardingQuestion, PreferencesRequest } from '@aca/shared';

/**
 * Every answer is held as an array, single-select included, so one shape covers
 * both question types and the step logic needs no branch per question.
 */
export type AnswerMap = Record<OnboardingQuestion['id'], string[]>;

const DEFAULT_MINIMUM_SELECTIONS = 1;

export function createEmptyAnswers(): AnswerMap {
  return { assets: [], investorType: [], contentTypes: [], riskTolerance: [] };
}

/** Bounds come from the question definition, so the server owns the limits. */
export function isAnswerComplete(question: OnboardingQuestion, selected: string[]): boolean {
  const minimum = question.min ?? DEFAULT_MINIMUM_SELECTIONS;
  if (selected.length < minimum) {
    return false;
  }
  return question.max === undefined || selected.length <= question.max;
}

/**
 * Parsed rather than cast. Answers are collected as plain strings, and parsing
 * is what turns them into the union types PreferencesRequest declares without
 * asserting a shape the compiler was never able to check.
 */
export function toPreferencesRequest(answers: AnswerMap): PreferencesRequest {
  return preferencesRequestSchema.parse({
    assets: answers.assets,
    investorType: answers.investorType[0],
    contentTypes: answers.contentTypes,
    riskTolerance: answers.riskTolerance[0],
  });
}
