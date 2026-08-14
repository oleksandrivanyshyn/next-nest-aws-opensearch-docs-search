import type { DocumentDto, SearchResponse, UploadUrlResponse } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    throw new Error(message ?? `Request failed with ${response.status}`);
  }

  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

export const api = {
  listDocuments(email: string): Promise<DocumentDto[]> {
    return request(`/documents?email=${encodeURIComponent(email)}`);
  },

  search(email: string, query: string): Promise<SearchResponse> {
    return request(
      `/documents/search?email=${encodeURIComponent(email)}&q=${encodeURIComponent(query)}`,
    );
  },

  deleteDocument(id: string, email: string): Promise<void> {
    return request(`/documents/${id}?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  },

  createUploadUrl(input: {
    email: string;
    filename: string;
    contentType: string;
    size: number;
  }): Promise<UploadUrlResponse> {
    return request('/documents/upload-url', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async uploadToS3(
    url: string,
    headers: Record<string, string>,
    file: File,
  ): Promise<void> {
    const sendable = { ...headers };
    delete sendable['Content-Length'];

    const response = await fetch(url, {
      method: 'PUT',
      headers: sendable,
      body: file,
    });
    if (!response.ok) {
      throw new Error(`S3 upload failed with ${response.status}`);
    }
  },
};
