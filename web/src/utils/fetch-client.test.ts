import { ApiError, client } from './fetch-client';

const respondWith = (
  body: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
): jest.Mock => {
  const json = jest.fn().mockResolvedValue(body);
  const fetchMock = jest.fn().mockResolvedValue({ ok, status, json });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const requestOf = (fetchMock: jest.Mock): { url: string; init: RequestInit } => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init };
};

const headersOf = (init: RequestInit): Record<string, string> =>
  init.headers as Record<string, string>;

describe('client query string', () => {
  it('appends the params it was given', async () => {
    const fetchMock = respondWith([]);

    await client('/documents', { params: { email: 'owner@example.com' } });

    expect(requestOf(fetchMock).url).toMatch(
      /\/documents\?email=owner%40example\.com$/,
    );
  });

  it('drops params that are undefined rather than sending the string', async () => {
    const fetchMock = respondWith([]);

    await client('/documents', {
      params: { email: 'owner@example.com', q: undefined },
    });

    expect(requestOf(fetchMock).url).not.toContain('q=');
  });

  it('leaves the url bare when every param is undefined', async () => {
    const fetchMock = respondWith([]);

    await client('/documents', { params: { email: undefined } });

    expect(requestOf(fetchMock).url).not.toContain('?');
  });
});

describe('client request shape', () => {
  it('defaults to GET with a json content type', async () => {
    const fetchMock = respondWith([]);

    await client('/documents');

    const { init } = requestOf(fetchMock);
    expect(init.method).toBe('GET');
    expect(headersOf(init)['Content-Type']).toBe('application/json');
  });

  it('lets the browser set the content type for FormData bodies', async () => {
    const fetchMock = respondWith({});

    await client('/documents', { method: 'POST', body: new FormData() });

    expect(headersOf(requestOf(fetchMock).init)['Content-Type']).toBeUndefined();
  });

  it('keeps caller headers alongside the json content type', async () => {
    const fetchMock = respondWith([]);

    await client('/documents', { headers: { 'X-Trace': 'abc' } });

    expect(headersOf(requestOf(fetchMock).init)).toMatchObject({
      'X-Trace': 'abc',
      'Content-Type': 'application/json',
    });
  });
});

describe('client error handling', () => {
  it('joins the array of messages a validation failure returns', async () => {
    respondWith(
      { message: ['email must be an email', 'size must not exceed 10 MB'] },
      { ok: false, status: 400 },
    );

    await expect(client('/documents')).rejects.toThrow(
      'email must be an email, size must not exceed 10 MB',
    );
  });

  it('uses a single string message as-is', async () => {
    respondWith({ message: 'Document not found' }, { ok: false, status: 404 });

    await expect(client('/documents')).rejects.toThrow('Document not found');
  });

  it('falls back to the status when the body carries no message', async () => {
    respondWith({}, { ok: false, status: 502 });

    await expect(client('/documents')).rejects.toThrow(
      'HTTP error! status: 502',
    );
  });

  it('survives an error body that is not json', async () => {
    const json = jest.fn().mockRejectedValue(new SyntaxError('Unexpected <'));
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500, json }) as unknown as typeof fetch;

    await expect(client('/documents')).rejects.toThrow(
      'HTTP error! status: 500',
    );
  });

  it('carries the status on the thrown ApiError', async () => {
    respondWith({ message: 'Forbidden' }, { ok: false, status: 403 });

    await expect(client('/documents')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
    });
    expect(new ApiError('boom', 400)).toBeInstanceOf(Error);
  });
});

describe('client response parsing', () => {
  it('returns an empty object for 204 without parsing a body', async () => {
    const json = jest.fn();
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 204, json }) as unknown as typeof fetch;

    await expect(client('/documents/abc', { method: 'DELETE' })).resolves.toEqual(
      {},
    );
    expect(json).not.toHaveBeenCalled();
  });

  it('returns the parsed body for a 200', async () => {
    respondWith([{ id: 'a' }]);

    await expect(client('/documents')).resolves.toEqual([{ id: 'a' }]);
  });
});
