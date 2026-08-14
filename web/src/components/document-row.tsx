'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { DocumentDto } from '@/lib/types';
import { useDocumentsStore } from '@/store/documents-store';
import { StatusBadge } from './status-badge';

export function DocumentRow({
  document,
  email,
}: {
  document: DocumentDto;
  email: string;
}) {
  const remove = useDocumentsStore((state) => state.remove);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteDocument(document.id, email);
      remove(document.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <li className="flex items-start justify-between gap-4 border-b border-black/8 py-3 last:border-0 dark:border-white/10">
      <div className="min-w-0">
        <p className="truncate font-medium">{document.userFilename}</p>
        <p className="text-xs opacity-60">
          {new Date(document.createdAt).toLocaleString()}
        </p>
        {document.status === 'ERROR' && document.errorMessage && (
          <p className="mt-1 text-xs text-red-600">{document.errorMessage}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={document.status} />
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm opacity-60 hover:text-red-600 hover:opacity-100 disabled:opacity-30"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
