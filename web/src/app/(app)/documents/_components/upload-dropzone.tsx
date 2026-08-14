'use client';

import { useUpload } from '../_hooks/use-upload';

export function UploadDropzone({ email }: { email: string }) {
  const { uploading, error, inputRef, upload } = useUpload(email);

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
            if (file) upload(file);
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

      {error && <p className="mt-3 text-sm text-red-600">{error.message}</p>}
    </section>
  );
}
