export type DocumentStatus = 'PENDING' | 'INDEXED' | 'ERROR';

export type DocumentDto = {
  id: string;
  userFilename: string;
  status: DocumentStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UploadUrlDto = {
  email: string;
  filename: string;
  contentType: string;
  size: number;
};

export type UploadUrlResponse = {
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  document: DocumentDto;
};
