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

// Mirrors the server's definition shape and order with shorter option lists;
// `max: 2` on the assets question is what makes the cap observable in a test.
const QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'contentTypes',
    label: 'What should the dashboard show?',
    type: 'multi-select',
    options: [
      { value: 'prices', label: 'Prices' },
      { value: 'news', label: 'News' },
      { value: 'insight', label: 'AI insight' },
      { value: 'memes', label: 'Memes' },
    ],
    min: 1,
  },
  {
    id: 'assets',
    label: 'Which assets do you follow?',
    type: 'multi-select',
    options: [
      { value: 'bitcoin', label: 'Bitcoin', image: 'https://example.com/bitcoin.png' },
      { value: 'ethereum', label: 'Ethereum', image: 'https://example.com/ethereum.png' },
      { value: 'solana', label: 'Solana', image: 'https://example.com/solana.png' },
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

    await user.click(screen.getByRole('checkbox', { name: 'Prices' }));

    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('stops further selection once the maximum is reached', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('checkbox', { name: 'Prices' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('checkbox', { name: 'Bitcoin' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ethereum' }));

    expect(screen.getByRole('checkbox', { name: 'Solana' })).toBeDisabled();
    // Deselecting has to stay available, or the cap becomes a dead end.
    expect(screen.getByRole('checkbox', { name: 'Bitcoin' })).toBeEnabled();
  });

  it('selects up to the maximum with the select-all toggle, then clears with it', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('checkbox', { name: 'Prices' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Select all' }));

    // Options 3 (Bitcoin, Ethereum, Solana), max 2: select-all stops at the
    // cap rather than proposing a selection the shared schema would reject.
    expect(screen.getByRole('checkbox', { name: 'Bitcoin' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Ethereum' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Solana' })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(screen.getByRole('checkbox', { name: 'Bitcoin' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Ethereum' })).not.toBeChecked();
  });

  it('keeps an earlier answer when the user steps back', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('checkbox', { name: 'Prices' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('checkbox', { name: 'Prices' })).toBeChecked();
  });

  it('submits every answer mapped onto the preferences request shape', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('checkbox', { name: 'AI insight' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('checkbox', { name: 'Bitcoin' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('radio', { name: 'HODLer' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('radio', { name: 'Low' }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    // Asserted on the first argument alone: React Query passes a mutation
    // context as a second argument that says nothing about the request body.
    expect(vi.mocked(savePreferences).mock.calls[0]?.[0]).toEqual({
      contentTypes: ['insight'],
      assets: ['bitcoin'],
      investorType: 'hodler',
      riskTolerance: 'low',
    });
  });

  // The friction this removes: describing a risk appetite to receive a ticker.
  it('asks two questions rather than four when no AI insight was chosen', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('checkbox', { name: 'Prices' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('checkbox', { name: 'Bitcoin' }));

    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    // A vote still records the profile it was cast under, so the pair is sent.
    expect(vi.mocked(savePreferences).mock.calls[0]?.[0]).toEqual({
      contentTypes: ['prices'],
      assets: ['bitcoin'],
      investorType: 'hodler',
      riskTolerance: 'medium',
    });
  });

  it('shows no denominator until contentTypes has an answer', () => {
    renderWizard();

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.queryByText(/Step 1 of/)).not.toBeInTheDocument();
  });

  it('skips the coin picker, and every other question, when only memes is selected', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('checkbox', { name: 'Memes' }));

    // None of assets, investorType or riskTolerance are read for a memes-only
    // dashboard, so contentTypes is the only question left to ask.
    expect(screen.getByText('Step 1 of 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    // The server still requires a non-empty assets array even though a
    // memes-only vote never reads it, so a single default coin satisfies it.
    expect(vi.mocked(savePreferences).mock.calls[0]?.[0]).toEqual({
      contentTypes: ['memes'],
      assets: ['bitcoin'],
      investorType: 'hodler',
      riskTolerance: 'medium',
    });
  });

  it('shows a coin icon on the assets question but not on contentTypes', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <QueryClientProvider client={createQueryClient()}>
        <OnboardingWizard questions={QUESTIONS} />
      </QueryClientProvider>,
    );

    // alt="" on every icon: it is decorative, the coin name is already the
    // checkbox label, so role="img" queries do not apply here.
    expect(container.querySelectorAll('img')).toHaveLength(0);

    await user.click(screen.getByRole('checkbox', { name: 'Prices' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const icons = container.querySelectorAll('img');
    expect(icons).toHaveLength(3);
    expect(icons[0]).toHaveAttribute('src', 'https://example.com/bitcoin.png');
  });

  it('grows back to four steps when the insight section is added', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('checkbox', { name: 'Prices' }));
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'AI insight' }));

    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });
});
