'use client';

import type { SearchHit } from '@/lib/types';
import { Highlight } from './highlight';

export function SearchResults({
  hits,
  query,
}: {
  hits: SearchHit[] | null;
  query: string;
}) {
  if (hits === null) {
    return <p className="py-8 text-center text-sm opacity-60">Searching…</p>;
  }

  if (hits.length === 0) {
    return (
      <p className="py-8 text-center text-sm opacity-60">
        No matches for “{query}”.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {hits.map((hit) => (
        <li key={hit.documentId}>
          <p className="font-medium">{hit.userFilename}</p>
          {hit.highlights.map((fragment, index) => (
            <p key={index} className="mt-1 text-sm opacity-80">
              …<Highlight fragment={fragment} />…
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}
