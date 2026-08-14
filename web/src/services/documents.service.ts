import { client } from '@/utils/fetch-client';
import type {
  DocumentDto,
  UploadUrlDto,
  UploadUrlResponse,
} from '@/types/document.types';
import type { SearchResponse } from '@/types/search.types';

export const documentKeys = {
  all: ['documents'] as const,
  list: (email: string) => ['documents', 'list', email] as const,
  search: (email: string, query: string) =>
    ['documents', 'search', email, query] as const,
};

export const documentsService = {
  list: (email: string) => {
    return client<DocumentDto[]>('/documents', { params: { email } });
  },

  search: (email: string, q: string) => {
    return client<SearchResponse>('/documents/search', { params: { email, q } });
  },

  delete: (id: string, email: string) => {
    return client<void>(`/documents/${id}`, {
      method: 'DELETE',
      params: { email },
    });
  },

  createUploadUrl: (data: UploadUrlDto) => {
    return client<UploadUrlResponse>('/documents/upload-url', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
