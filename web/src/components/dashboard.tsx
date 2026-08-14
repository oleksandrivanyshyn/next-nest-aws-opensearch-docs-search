'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSse } from '@/hooks/use-sse';
import type { SearchHit } from '@/lib/types';
import { useDocumentsStore } from '@/store/documents-store';
import { useUserStore } from '@/store/user-store';
import { DocumentList } from './document-list';
import { SearchBar } from './search-bar';
import { SearchResults } from './search-results';
import { UploadCard } from './upload-card';

interface SearchResult {
  query: string;
  hits: SearchHit[];
}

export function Dashboard({ email }: { email: string }) {
  const signOut = useUserStore((state) => state.signOut);
  const documents = useDocumentsStore((state) => state.documents);
  const setDocuments = useDocumentsStore((state) => state.setDocuments);
  const { connected } = useSse(email);

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const trimmedQuery = useDebouncedValue(query, 300).trim();

  useEffect(() => {
    void api
      .listDocuments(email)
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, [email, setDocuments]);

  useEffect(() => {
    if (!trimmedQuery) return;

    let cancelled = false;
    const settle = (hits: SearchHit[]) => {
      if (!cancelled) setResult({ query: trimmedQuery, hits });
    };

    void api
      .search(email, trimmedQuery)
      .then((response) => settle(response.hits))
      .catch(() => settle([]));

    return () => {
      cancelled = true;
    };
  }, [email, trimmedQuery]);

  const hits = result?.query === trimmedQuery ? result.hits : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Document search</h1>
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
            onClick={signOut}
            className="underline opacity-60 hover:opacity-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <UploadCard email={email} />

      <SearchBar value={query} onChange={setQuery} />

      {trimmedQuery ? (
        <SearchResults hits={hits} query={trimmedQuery} />
      ) : (
        <DocumentList documents={documents} email={email} />
      )}
    </main>
  );
}
