import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { OnboardingQuestion } from '@aca/shared';

import { OnboardingWizard } from '../features/onboarding/OnboardingWizard.js';
import { savePreferences } from '../features/preferences/api.js';
import { createQueryClient } from '../lib/query-client.js';

vi.mock('../features/preferences/api.js', () => ({
  fetchPreferences: vi.fn(),
  savePreferences: vi.fn(() => Promise.resolve({ preferences: null })),
}));

// Mirrors the server's definition shape with shorter option lists; `max: 2` on
// the first question is what makes the cap observable in a test.
const QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'assets',
    label: 'Which assets do you follow?',
    type: 'multi-select',
    options: [
      { value: 'bitcoin', label: 'Bitcoin' },
      { value: 'ethereum', label: 'Ethereum' },
      { value: 'solana', label: 'Solana' },
    ],
    min: 1,
    max: 2,
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
    id: 'contentTypes',
    label: 'What should the dashboard show?',
    type: 'multi-select',
    options: [
      { value: 'prices', label: 'Prices' },
      { value: 'news', label: 'News' },
    ],
    min: 1,
  },
  {
    id: 'riskTolerance',
    label: 'How much risk is comfortable?',
    type: 'single-select',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
  },
];

function renderWizard() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <OnboardingWizard questions={QUESTIONS} />
    </QueryClientProvider>,
  );
}

describe('OnboardingWizard', () => {
  it('blocks the step until the question’s minimum is met', async () => {
    const user = userEvent.setup();
    renderWizard();

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'Bitcoin' }));

    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('stops further selection once the maximum is reached', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('checkbox', { name: 'Bitcoin' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ethereum' }));

    expect(screen.getByRole('checkbox', { name: 'Solana' })).toBeDisabled();
    // Deselecting has to stay available, or the cap becomes a dead end.
    expect(screen.getByRole('checkbox', { name: 'Bitcoin' })).toBeEnabled();
  });

  it('keeps an earlier answer when the user steps back', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('checkbox', { name: 'Bitcoin' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('checkbox', { name: 'Bitcoin' })).toBeChecked();
  });

  it('submits every answer mapped onto the preferences request shape', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('checkbox', { name: 'Bitcoin' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('radio', { name: 'HODLer' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('checkbox', { name: 'Prices' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('radio', { name: 'Medium' }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    // Asserted on the first argument alone: React Query passes a mutation
    // context as a second argument that says nothing about the request body.
    expect(vi.mocked(savePreferences).mock.calls[0]?.[0]).toEqual({
      assets: ['bitcoin'],
      investorType: 'hodler',
      contentTypes: ['prices'],
      riskTolerance: 'medium',
    });
  });
});
