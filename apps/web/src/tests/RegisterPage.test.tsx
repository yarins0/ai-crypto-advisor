import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { register } from '../features/auth/api.js';
import { RegisterPage } from '../features/auth/RegisterPage.js';
import { createQueryClient } from '../lib/query-client.js';

vi.mock('../features/auth/api.js', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  loadSession: vi.fn(),
}));

function renderRegisterPage() {
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RegisterPage', () => {
  it('blocks submission and shows an error when the passwords do not match', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Name'), 'Grace');
    await user.type(screen.getByLabelText('Email'), 'grace@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.type(screen.getByLabelText('Confirm password'), 'wrong-horse');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('submits only the auth fields when the passwords match', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Name'), 'Grace');
    await user.type(screen.getByLabelText('Email'), 'grace@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(vi.mocked(register).mock.calls[0]?.[0]).toEqual({
      name: 'Grace',
      email: 'grace@example.com',
      password: 'correct-horse',
    });
  });
});
