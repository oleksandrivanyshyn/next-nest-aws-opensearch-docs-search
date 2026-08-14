'use client';

import type { DocumentDto } from '@/lib/types';
import { DocumentRow } from './document-row';

export function DocumentList({
  documents,
  email,
}: {
  documents: DocumentDto[];
  email: string;
}) {
  if (documents.length === 0) {
    return (
      <p className="py-8 text-center text-sm opacity-60">No documents yet.</p>
    );
  }

  return (
    <ul>
      {documents.map((document) => (
        <DocumentRow key={document.id} document={document} email={email} />
      ))}
    </ul>
  );
}
