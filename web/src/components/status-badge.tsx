import type { DocumentStatus } from '@/lib/types';

const STYLES: Record<DocumentStatus, string> = {
  PENDING:
    'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  INDEXED:
    'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
  ERROR: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
};

const LABELS: Record<DocumentStatus, string> = {
  PENDING: 'Processing…',
  INDEXED: 'Searchable',
  ERROR: 'Failed',
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {status === 'PENDING' && (
        <span
          className="size-1.5 animate-pulse rounded-full bg-current"
          aria-hidden
        />
      )}
      {LABELS[status]}
    </span>
  );
}
