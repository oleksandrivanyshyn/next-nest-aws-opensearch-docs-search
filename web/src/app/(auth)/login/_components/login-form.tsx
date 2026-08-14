'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isValidEmail } from '@/utils/email';
import { useUserStore } from '@/store/user-store';

export function LoginForm() {
  const setEmail = useUserStore((state) => state.setEmail);
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidEmail(value)) {
      setError('Please enter a valid email address');
      return;
    }
    setEmail(value);
    router.replace('/');
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Document search</h1>
        <p className="mt-1 text-sm opacity-70">
          Enter your email to continue. Your documents are scoped to this
          address.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder="you@example.com"
          autoFocus
          className="rounded-lg border border-black/15 px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="rounded-lg bg-foreground px-3 py-2 font-medium text-background"
        >
          Continue
        </button>
      </form>
    </>
  );
}
