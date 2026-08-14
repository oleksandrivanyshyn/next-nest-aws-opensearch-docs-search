'use client';

import { useRedirectBySession } from '@/hooks/use-redirect-by-session';
import { LoginForm } from './_components/login-form';

export default function LoginPage() {
  const { ready } = useRedirectBySession('signed-out', '/');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      {ready ? <LoginForm /> : <div aria-busy />}
    </div>
  );
}
