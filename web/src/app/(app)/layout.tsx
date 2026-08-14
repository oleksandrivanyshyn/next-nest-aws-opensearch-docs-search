'use client';

import type { ReactNode } from 'react';
import { useRedirectBySession } from '@/hooks/use-redirect-by-session';
import { useSse } from '@/hooks/use-sse';
import { AppHeader } from './_components/app-header';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { email, ready } = useRedirectBySession('signed-in', '/login');
  const { connected } = useSse(email);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      {ready && email ? (
        <>
          <AppHeader email={email} connected={connected} />
          {children}
        </>
      ) : (
        <div className="min-h-dvh" aria-busy />
      )}
    </div>
  );
}
