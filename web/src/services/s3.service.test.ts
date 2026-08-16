import { s3Service } from './s3.service';

const PRESIGNED_URL = 'https://bucket.s3.amazonaws.com/uploads/a.pdf?X-Amz-Sig=x';

const file = new File(['pdf bytes'], 'report.pdf', {
  type: 'application/pdf',
});

const headers = (): Record<string, string> => ({
  'Content-Type': 'application/pdf',
  'Content-Length': '9',
});

const respondWith = (status: number): jest.Mock => {
  const fetchMock = jest
    .fn()
    .mockResolvedValue({ ok: status >= 200 && status < 300, status });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const initOf = (fetchMock: jest.Mock): RequestInit =>
  (fetchMock.mock.calls[0] as [string, RequestInit])[1];

describe('s3Service.upload', () => {
  it('strips Content-Length, which the browser refuses to let us set', async () => {
    const fetchMock = respondWith(200);

    await s3Service.upload(PRESIGNED_URL, headers(), file);

    const sent = initOf(fetchMock).headers as Record<string, string>;
    expect(sent).not.toHaveProperty('Content-Length');
    expect(sent['Content-Type']).toBe('application/pdf');
  });

  it('PUTs the file straight to the presigned url', async () => {
    const fetchMock = respondWith(200);

    await s3Service.upload(PRESIGNED_URL, headers(), file);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(PRESIGNED_URL);
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(file);
  });

  it('leaves the caller header object untouched', async () => {
    respondWith(200);
    const original = headers();

    await s3Service.upload(PRESIGNED_URL, original, file);

    expect(original['Content-Length']).toBe('9');
  });

  it('throws with the status when S3 rejects the upload', async () => {
    respondWith(403);

    await expect(s3Service.upload(PRESIGNED_URL, headers(), file)).rejects.toThrow(
      'S3 upload failed with 403',
    );
  });
});
