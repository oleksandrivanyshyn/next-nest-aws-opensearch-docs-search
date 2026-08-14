'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from './use-session';
import type { Session } from './use-session';

export function useRedirectBySession(
  requirement: 'signed-in' | 'signed-out',
  destination: string,
): Session {
  const session = useSession();
  const router = useRouter();

  const misplaced =
    session.ready &&
    (requirement === 'signed-in' ? !session.email : Boolean(session.email));

  useEffect(() => {
    if (misplaced) router.replace(destination);
  }, [misplaced, router, destination]);

  return { email: session.email, ready: session.ready && !misplaced };
}
