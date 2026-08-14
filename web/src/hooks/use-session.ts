'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useUserStore } from '@/store/user-store';

const subscribe = (onChange: () => void): (() => void) =>
  useUserStore.persist.onFinishHydration(onChange);

export interface Session {
  email: string | null;
  ready: boolean;
}

export function useSession(): Session {
  const email = useUserStore((state) => state.email);
  const ready = useSyncExternalStore(
    subscribe,
    () => useUserStore.persist.hasHydrated(),
    () => false,
  );

  useEffect(() => {
    void useUserStore.persist.rehydrate();
  }, []);

  return { email, ready };
}
