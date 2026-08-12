import type { DocumentResponseDto } from './document.dto';

export interface UploadUrlResponse {
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  document: DocumentResponseDto;
}
