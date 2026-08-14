export type DocumentStatus = 'PENDING' | 'INDEXED' | 'ERROR';

export interface DocumentDto {
  id: string;
  userFilename: string;
  status: DocumentStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  document: DocumentDto;
}

export interface SearchHit {
  documentId: string;
  userFilename: string;
  createdAt: string;
  score: number;
  highlights: string[];
}

export interface SearchResponse {
  total: number;
  hits: SearchHit[];
}
