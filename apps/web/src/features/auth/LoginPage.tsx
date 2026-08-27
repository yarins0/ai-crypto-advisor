import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';

import { Button } from '../../components/Button.js';
import { FormBanner } from '../../components/FormBanner.js';
import { TextField } from '../../components/TextField.js';
import { getFieldError, getFormMessage } from '../../lib/api/form-errors.js';
import { AuthLayout } from './AuthLayout.js';
import { useLogin } from './use-session.js';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();
  const formMessage = getFormMessage(loginMutation.error);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Your dashboard, built from what you actually follow."
      footer={
        <>
          No account yet?{' '}
          <Link to="/register" className="font-medium text-ink underline">
            Create one
          </Link>
        </>
      }
    >
      {/* noValidate hands validation to the shared Zod schema on the server, so
          one set of rules decides what a valid credential is. */}
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formMessage === null ? null : <FormBanner message={formMessage} />}
        <TextField
          id="email"
          label="Email"
          type="email"
          value={email}
          autoComplete="email"
          error={getFieldError(loginMutation.error, 'email')}
          onChange={setEmail}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          value={password}
          autoComplete="current-password"
          error={getFieldError(loginMutation.error, 'password')}
          onChange={setPassword}
        />
        <Button type="submit" isPending={loginMutation.isPending}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
