import { preferencesRequestSchema } from '@aca/shared';
import type {
  InvestorType,
  OnboardingQuestion,
  PreferencesRequest,
  PreferencesResponse,
  RiskTolerance,
} from '@aca/shared';

/**
 * Every answer is held as an array, single-select included, so one shape covers
 * both question types and the step logic needs no branch per question.
 */
export type AnswerMap = Record<OnboardingQuestion['id'], string[]>;

const DEFAULT_MINIMUM_SELECTIONS = 1;

/** The only section whose content is built from the tuning answers below. */
const TUNED_CONTENT_TYPE = 'insight';

const TUNING_QUESTION_IDS: readonly OnboardingQuestion['id'][] = ['investorType', 'riskTolerance'];

// Every vote records the profile it was cast under, so these two are sent even
// when nobody was asked for them. The cost is that a snapshot cannot distinguish
// a chosen value from a defaulted one.
const DEFAULT_INVESTOR_TYPE: InvestorType = 'hodler';
const DEFAULT_RISK_TOLERANCE: RiskTolerance = 'medium';

/**
 * Asking someone to describe their risk appetite to receive a price ticker is
 * the friction this removes: the pair is only worth a question when the section
 * that reads it is on.
 */
export function requiresTuning(answers: AnswerMap): boolean {
  return answers.contentTypes.includes(TUNED_CONTENT_TYPE);
}

/** The questions worth putting in front of someone, given what they have chosen so far. */
export function selectAskableQuestions(
  questions: OnboardingQuestion[],
  answers: AnswerMap,
): OnboardingQuestion[] {
  if (requiresTuning(answers)) {
    return questions;
  }
  return questions.filter((question) => !TUNING_QUESTION_IDS.includes(question.id));
}

export function createEmptyAnswers(): AnswerMap {
  return { assets: [], investorType: [], contentTypes: [], riskTolerance: [] };
}

/** Inverse of toPreferencesRequest, for prefilling the preferences screen. */
export function toAnswerMap(preferences: PreferencesResponse): AnswerMap {
  return {
    assets: [...preferences.assets],
    investorType: [preferences.investorType],
    contentTypes: [...preferences.contentTypes],
    riskTolerance: [preferences.riskTolerance],
  };
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
    investorType: answers.investorType[0] ?? DEFAULT_INVESTOR_TYPE,
    contentTypes: answers.contentTypes,
    riskTolerance: answers.riskTolerance[0] ?? DEFAULT_RISK_TOLERANCE,
  });
}
