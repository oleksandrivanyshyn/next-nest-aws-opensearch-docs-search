'use client';

import type { DocumentDto } from '@/types/document.types';
import { useDeleteDocument } from '../_hooks/use-documents';
import { StatusBadge } from './status-badge';

export function DocumentRow({
  document,
  email,
}: {
  document: DocumentDto;
  email: string;
}) {
  const { mutate: remove, isPending } = useDeleteDocument(email);

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
          onClick={() => remove(document.id)}
          disabled={isPending}
          className="text-sm opacity-60 hover:text-red-600 hover:opacity-100 disabled:opacity-30"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
