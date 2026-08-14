'use client';

import { useSession } from '@/hooks/use-session';
import { SearchBar } from './_components/search-bar';
import { SearchResults } from './_components/search-results';
import { useDocumentSearch } from './_hooks/use-document-search';

export default function SearchPage() {
  const { email } = useSession();

  if (!email) return null;

  return <SearchView email={email} />;
}

function SearchView({ email }: { email: string }) {
  const { query, setQuery, activeQuery, hits, isLoading, error } =
    useDocumentSearch(email);

  return (
    <>
      <SearchBar value={query} onChange={setQuery} />

      {!activeQuery && (
        <p className="py-8 text-center text-sm opacity-60">
          Type to search inside your documents. Typos are tolerated.
        </p>
      )}

      {activeQuery && error && (
        <p className="py-8 text-center text-sm text-red-600">{error.message}</p>
      )}

      {activeQuery && !error && (
        <SearchResults
          hits={isLoading ? null : hits}
          query={activeQuery}
        />
      )}
    </>
  );
}
