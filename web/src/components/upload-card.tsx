'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { resolveContentType, validateFile } from '@/lib/validation';
import { useDocumentsStore } from '@/store/documents-store';

export function UploadCard({ email }: { email: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upsert = useDocumentsStore((state) => state.upsert);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    const problem = validateFile(file);
    if (problem) {
      setError(problem);
      return;
    }

    const contentType = resolveContentType(file.name);
    if (!contentType) return;

    setUploading(true);
    try {
      const { uploadUrl, requiredHeaders, document } =
        await api.createUploadUrl({
          email,
          filename: file.name,
          contentType,
          size: file.size,
        });

      await api.uploadToS3(uploadUrl, requiredHeaders, file);
      upsert(document);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'Upload failed',
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section className="rounded-xl border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium">Upload a document</h2>
          <p className="text-sm opacity-60">
            .pdf or .docx, up to 10 MB, one at a time
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
          className="hidden"
          id="file-input"
        />
        <label
          htmlFor="file-input"
          aria-disabled={uploading}
          className="cursor-pointer rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background aria-disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Choose file'}
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
