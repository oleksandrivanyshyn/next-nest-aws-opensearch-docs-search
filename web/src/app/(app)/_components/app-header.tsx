'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUserStore } from '@/store/user-store';

const LINKS = [
  { href: '/', label: 'Search' },
  { href: '/documents', label: 'Documents' },
];

export function AppHeader({
  email,
  connected,
}: {
  email: string;
  connected: boolean;
}) {
  const signOut = useUserStore((state) => state.signOut);
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10">
      <nav className="flex items-center gap-4">
        <span className="font-semibold">Document search</span>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? 'page' : undefined}
            className="text-sm opacity-60 hover:opacity-100 aria-[current=page]:opacity-100 aria-[current=page]:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5 opacity-70">
          <span
            className={`size-2 rounded-full ${connected ? 'bg-green-500' : 'bg-amber-500'}`}
            aria-hidden
          />
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
        <span className="opacity-60">{email}</span>
        <button
          onClick={() => {
            signOut();
            router.replace('/login');
          }}
          className="underline opacity-60 hover:opacity-100"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
