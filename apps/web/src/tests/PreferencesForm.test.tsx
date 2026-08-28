import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { OnboardingQuestion } from '@aca/shared';

import { savePreferences } from '../features/preferences/api.js';
import { PreferencesForm } from '../features/preferences/PreferencesForm.js';
import type { AnswerMap } from '../features/preferences/answers.js';
import { createQueryClient } from '../lib/query-client.js';

vi.mock('../features/preferences/api.js', () => ({
  fetchPreferences: vi.fn(),
  savePreferences: vi.fn(() => Promise.resolve({ preferences: null })),
}));

const QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'contentTypes',
    label: 'What should the dashboard show?',
    type: 'multi-select',
    options: [
      { value: 'prices', label: 'Prices' },
      { value: 'insight', label: 'AI insight' },
    ],
    min: 1,
  },
  {
    id: 'assets',
    label: 'Which assets do you follow?',
    type: 'multi-select',
    options: [{ value: 'bitcoin', label: 'Bitcoin' }],
    min: 1,
  },
  {
    id: 'investorType',
    label: 'What kind of investor are you?',
    type: 'single-select',
    options: [
      { value: 'hodler', label: 'HODLer' },
      { value: 'day_trader', label: 'Day trader' },
    ],
  },
  {
    id: 'riskTolerance',
    label: 'How much risk is comfortable?',
    type: 'single-select',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
    ],
  },
];

// The state a user reaches by onboarding without the insight section: values
// exist for the tuning pair because a vote needs them, but nobody was asked.
const PRICES_ONLY_ANSWERS: AnswerMap = {
  contentTypes: ['prices'],
  assets: ['bitcoin'],
  investorType: ['hodler'],
  riskTolerance: ['medium'],
};

function renderForm(initialAnswers: AnswerMap) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <PreferencesForm questions={QUESTIONS} initialAnswers={initialAnswers} />
    </QueryClientProvider>,
  );
}

describe('PreferencesForm', () => {
  it('hides the tuning questions while the insight section is off', () => {
    renderForm(PRICES_ONLY_ANSWERS);

    expect(screen.queryByRole('radio', { name: 'HODLer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Low' })).not.toBeInTheDocument();
  });

  // Adding the section that reads them is the moment they become worth asking,
  // so they have to reappear here rather than keep a default nobody chose.
  it('reopens the tuning questions when the insight section is added', async () => {
    const user = userEvent.setup();
    renderForm(PRICES_ONLY_ANSWERS);

    await user.click(screen.getByRole('checkbox', { name: 'AI insight' }));

    expect(screen.getByRole('radio', { name: 'HODLer' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Low' })).toBeInTheDocument();
  });

  it('lets a reopened answer be changed and saved', async () => {
    const user = userEvent.setup();
    renderForm(PRICES_ONLY_ANSWERS);

    await user.click(screen.getByRole('checkbox', { name: 'AI insight' }));
    await user.click(screen.getByRole('radio', { name: 'Day trader' }));
    await user.click(screen.getByRole('button', { name: 'Save preferences' }));

    expect(vi.mocked(savePreferences).mock.calls[0]?.[0]).toEqual({
      contentTypes: ['prices', 'insight'],
      assets: ['bitcoin'],
      investorType: 'day_trader',
      riskTolerance: 'medium',
    });
  });

  // Hidden is not discarded: the stored pair still travels with every save,
  // because a vote cast afterwards records the profile it was cast under.
  it('still sends the tuning pair while it is hidden', async () => {
    const user = userEvent.setup();
    renderForm(PRICES_ONLY_ANSWERS);

    await user.click(screen.getByRole('button', { name: 'Save preferences' }));

    expect(vi.mocked(savePreferences).mock.calls[0]?.[0]).toEqual({
      contentTypes: ['prices'],
      assets: ['bitcoin'],
      investorType: 'hodler',
      riskTolerance: 'medium',
    });
  });
});
