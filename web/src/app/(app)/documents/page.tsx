'use client';

import { useSession } from '@/hooks/use-session';
import { DocumentTable } from './_components/document-table';
import { UploadDropzone } from './_components/upload-dropzone';
import { useDocuments } from './_hooks/use-documents';

export default function DocumentsPage() {
  const { email } = useSession();

  if (!email) return null;

  return <DocumentsView email={email} />;
}

function DocumentsView({ email }: { email: string }) {
  const { data: documents, isLoading, isError, error } = useDocuments(email);

  return (
    <>
      <UploadDropzone email={email} />

      {isLoading && (
        <p className="py-8 text-center text-sm opacity-60">
          Loading documents…
        </p>
      )}

      {isError && (
        <p className="py-8 text-center text-sm text-red-600">
          {error.message || 'Failed to load documents.'}
        </p>
      )}

      {documents && <DocumentTable documents={documents} email={email} />}
    </>
  );
}
