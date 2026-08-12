export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const UPLOAD_PREFIX = 'uploads/';

export const ALLOWED_MIME_MAP = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_MIME_MAP;

export const ALLOWED_MIME_TYPES = Object.keys(
  ALLOWED_MIME_MAP,
) as AllowedMimeType[];
