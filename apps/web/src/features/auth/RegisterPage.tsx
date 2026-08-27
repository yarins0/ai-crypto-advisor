import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';

import { Button } from '../../components/Button.js';
import { FormBanner } from '../../components/FormBanner.js';
import { TextField } from '../../components/TextField.js';
import { getFieldError, getFormMessage } from '../../lib/api/form-errors.js';
import { AuthLayout } from './AuthLayout.js';
import { useRegister } from './use-session.js';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const registerMutation = useRegister();
  const formMessage = getFormMessage(registerMutation.error);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    registerMutation.mutate({ name, email, password });
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Four questions, then your dashboard."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-ink underline">
            Sign in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formMessage === null ? null : <FormBanner message={formMessage} />}
        <TextField
          id="name"
          label="Name"
          type="text"
          value={name}
          autoComplete="name"
          error={getFieldError(registerMutation.error, 'name')}
          onChange={setName}
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          value={email}
          autoComplete="email"
          error={getFieldError(registerMutation.error, 'email')}
          onChange={setEmail}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          value={password}
          autoComplete="new-password"
          error={getFieldError(registerMutation.error, 'password')}
          onChange={setPassword}
        />
        <Button type="submit" isPending={registerMutation.isPending}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
