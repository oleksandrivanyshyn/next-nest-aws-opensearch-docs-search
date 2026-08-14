'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Dashboard } from '@/components/dashboard';
import { EmailGate } from '@/components/email-gate';
import { useUserStore } from '@/store/user-store';

const subscribeToHydration = (onChange: () => void): (() => void) =>
  useUserStore.persist.onFinishHydration(onChange);

export default function Home() {
  const email = useUserStore((state) => state.email);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => useUserStore.persist.hasHydrated(),
    () => false,
  );

  useEffect(() => {
    void useUserStore.persist.rehydrate();
  }, []);

  if (!hydrated) {
    return <div className="min-h-dvh" aria-busy />;
  }

  return email ? <Dashboard email={email} /> : <EmailGate />;
}
