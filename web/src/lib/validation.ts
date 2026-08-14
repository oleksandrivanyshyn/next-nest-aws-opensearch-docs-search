export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const MIME_PDF = 'application/pdf';
export const MIME_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': MIME_PDF,
  '.docx': MIME_DOCX,
};

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function resolveContentType(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return null;
  return MIME_BY_EXTENSION[filename.slice(dot).toLowerCase()] ?? null;
}

export function validateFile(file: File): string | null {
  if (!resolveContentType(file.name)) {
    return 'Only .pdf and .docx files are supported';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB`;
  }
  if (file.size === 0) {
    return 'File is empty';
  }
  return null;
}
