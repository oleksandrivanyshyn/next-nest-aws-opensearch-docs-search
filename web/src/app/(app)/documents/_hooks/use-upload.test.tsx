import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpload } from './use-upload';
import { documentKeys } from '@/services/documents.service';
import { MIME_PDF } from '@/utils/file-validation';
import type { DocumentDto, UploadUrlDto } from '@/types/document.types';

jest.mock('@/services/documents.service', () => {
  const actual = jest.requireActual(
    '@/services/documents.service',
  ) as typeof import('@/services/documents.service');

  return {
    documentKeys: actual.documentKeys,
    documentsService: { createUploadUrl: jest.fn(), delete: jest.fn() },
  };
});

jest.mock('@/services/s3.service', () => ({
  s3Service: { upload: jest.fn() },
}));

const { documentsService } = jest.requireMock(
  '@/services/documents.service',
) as { documentsService: { createUploadUrl: jest.Mock; delete: jest.Mock } };

const { s3Service } = jest.requireMock('@/services/s3.service') as {
  s3Service: { upload: jest.Mock };
};

const EMAIL = 'owner@example.com';
const UPLOAD_URL = 'https://bucket.s3.amazonaws.com/uploads/a.pdf?X-Amz-Sig=x';

const buildDocument = (overrides: Partial<DocumentDto> = {}): DocumentDto => ({
  id: '11111111-1111-4111-8111-111111111111',
  userFilename: 'report.pdf',
  status: 'PENDING',
  errorMessage: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const renderUpload = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { ...renderHook(() => useUpload(EMAIL), { wrapper }), queryClient };
};

const createUploadUrlArgs = (): UploadUrlDto =>
  documentsService.createUploadUrl.mock.calls[0][0] as UploadUrlDto;

beforeEach(() => {
  jest.clearAllMocks();
  documentsService.createUploadUrl.mockResolvedValue({
    uploadUrl: UPLOAD_URL,
    requiredHeaders: { 'Content-Type': MIME_PDF, 'Content-Length': '9' },
    document: buildDocument(),
  });
  s3Service.upload.mockResolvedValue(undefined);
  documentsService.delete.mockResolvedValue(undefined);
});

describe('useUpload', () => {
  it('never reaches the network when the file fails validation', async () => {
    const { result } = renderUpload();

    act(() => result.current.upload(new File(['x'], 'notes.txt')));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toContain('.pdf and .docx');
    expect(documentsService.createUploadUrl).not.toHaveBeenCalled();
    expect(s3Service.upload).not.toHaveBeenCalled();
  });

  it('derives the content type from the extension, not from the browser', async () => {
    const { result } = renderUpload();
    const file = new File(['pdf bytes'], 'report.pdf', {
      type: 'application/octet-stream',
    });

    act(() => result.current.upload(file));

    await waitFor(() => expect(documentsService.createUploadUrl).toHaveBeenCalled());
    expect(createUploadUrlArgs()).toMatchObject({
      email: EMAIL,
      filename: 'report.pdf',
      contentType: MIME_PDF,
      size: file.size,
    });
  });

  it('PUTs the file to the presigned url the api handed back', async () => {
    const { result } = renderUpload();
    const file = new File(['pdf bytes'], 'report.pdf');

    act(() => result.current.upload(file));

    await waitFor(() => expect(s3Service.upload).toHaveBeenCalled());
    expect(s3Service.upload).toHaveBeenCalledWith(
      UPLOAD_URL,
      { 'Content-Type': MIME_PDF, 'Content-Length': '9' },
      file,
    );
  });

  it('prepends the pending document to the cached list', async () => {
    const { result, queryClient } = renderUpload();
    queryClient.setQueryData(documentKeys.list(EMAIL), [
      buildDocument({ id: 'older' }),
    ]);

    act(() => result.current.upload(new File(['pdf bytes'], 'report.pdf')));

    await waitFor(() =>
      expect(
        queryClient.getQueryData<DocumentDto[]>(documentKeys.list(EMAIL)),
      ).toHaveLength(2),
    );
    expect(
      queryClient
        .getQueryData<DocumentDto[]>(documentKeys.list(EMAIL))
        ?.map((document) => document.id),
    ).toEqual(['11111111-1111-4111-8111-111111111111', 'older']);
  });

  it('does not index the document when the S3 PUT fails', async () => {
    s3Service.upload.mockRejectedValue(new Error('S3 upload failed with 403'));
    const { result, queryClient } = renderUpload();

    act(() => result.current.upload(new File(['pdf bytes'], 'report.pdf')));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(
      queryClient.getQueryData<DocumentDto[]>(documentKeys.list(EMAIL)),
    ).toBeUndefined();
  });

  it('rolls back the pending row when the s3 upload fails', async () => {
    s3Service.upload.mockRejectedValue(new Error('S3 upload failed with 403'));
    const { result } = renderUpload();

    act(() => result.current.upload(new File(['pdf bytes'], 'report.pdf')));

    await waitFor(() => expect(documentsService.delete).toHaveBeenCalled());
    expect(documentsService.delete).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      EMAIL,
    );
  });

  it('still surfaces the original upload error when the rollback itself fails', async () => {
    s3Service.upload.mockRejectedValue(new Error('S3 upload failed with 403'));
    documentsService.delete.mockRejectedValue(new Error('row already gone'));
    const { result } = renderUpload();

    act(() => result.current.upload(new File(['pdf bytes'], 'report.pdf')));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('S3 upload failed with 403');
  });

  it('does not roll back once the s3 upload has actually succeeded', async () => {
    const { result } = renderUpload();

    act(() => result.current.upload(new File(['pdf bytes'], 'report.pdf')));

    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(documentsService.delete).not.toHaveBeenCalled();
  });
});
