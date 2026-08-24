import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSse } from './use-sse';
import { documentKeys } from '@/services/documents.service';
import type { DocumentDto } from '@/types/document.types';

const EMAIL = 'owner@example.com';

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onerror: (() => void) | null = null;
  closed = false;

  private readonly listeners = new Map<string, ((event: Event) => void)[]>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
  }

  dispatch(type: string, data?: unknown): void {
    const event = { type, data: JSON.stringify(data) } as unknown as Event;
    act(() => {
      this.listeners.get(type)?.forEach((listener) => listener(event));
    });
  }

  fail(): void {
    act(() => {
      this.onerror?.();
    });
  }
}

const latestStream = (): FakeEventSource => {
  const stream = FakeEventSource.instances.at(-1);
  if (!stream) throw new Error('No EventSource was opened');
  return stream;
};

const buildDocument = (overrides: Partial<DocumentDto> = {}): DocumentDto => ({
  id: '11111111-1111-4111-8111-111111111111',
  userFilename: 'report.pdf',
  status: 'PENDING',
  errorMessage: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const renderSse = (email: string | null = EMAIL) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = renderHook(({ current }) => useSse(current), {
    wrapper,
    initialProps: { current: email },
  });

  return { ...view, queryClient };
};

const cachedList = (queryClient: QueryClient): DocumentDto[] | undefined =>
  queryClient.getQueryData<DocumentDto[]>(documentKeys.list(EMAIL));

beforeEach(() => {
  FakeEventSource.instances = [];
  global.EventSource = FakeEventSource as unknown as typeof EventSource;
});

describe('useSse connection', () => {
  it('opens one stream scoped to the encoded email', () => {
    renderSse();

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(latestStream().url).toContain(
      '/notifications/sse?email=owner%40example.com',
    );
  });

  it('opens nothing until an email is known', () => {
    const { result } = renderSse(null);

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(result.current.connected).toBe(false);
  });

  it('reports connected once the stream opens', () => {
    const { result } = renderSse();

    latestStream().dispatch('open');

    expect(result.current.connected).toBe(true);
  });

  it('treats a heartbeat as proof the stream is still alive', () => {
    const { result } = renderSse();

    latestStream().dispatch('ping');

    expect(result.current.connected).toBe(true);
  });

  it('drops the connected flag when the stream errors', () => {
    const { result } = renderSse();
    latestStream().dispatch('open');

    latestStream().fail();

    expect(result.current.connected).toBe(false);
  });

  it('closes the stream on unmount', () => {
    const { unmount } = renderSse();
    const stream = latestStream();

    unmount();

    expect(stream.closed).toBe(true);
  });

  it('closes the old stream and opens a new one when the email changes', () => {
    const { rerender } = renderSse();
    const first = latestStream();

    rerender({ current: 'other@example.com' });

    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(latestStream().url).toContain('email=other%40example.com');
  });
});

describe('useSse cache updates', () => {
  it('replaces the matching document in the cached list', () => {
    const { queryClient } = renderSse();
    queryClient.setQueryData(documentKeys.list(EMAIL), [
      buildDocument(),
      buildDocument({ id: 'other' }),
    ]);

    latestStream().dispatch('document', buildDocument({ status: 'INDEXED' }));

    const list = cachedList(queryClient);
    expect(list?.[0].status).toBe('INDEXED');
    expect(list?.map((document) => document.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      'other',
    ]);
  });

  it('marks the connection alive on a document event too', () => {
    const { result } = renderSse();

    latestStream().dispatch('document', buildDocument());

    expect(result.current.connected).toBe(true);
  });

  it('does not seed a cache the list query has never filled', () => {
    const { queryClient } = renderSse();

    latestStream().dispatch('document', buildDocument({ status: 'INDEXED' }));

    expect(cachedList(queryClient)).toBeUndefined();
  });

  it('invalidates the list and search caches so stale results refresh', () => {
    const { queryClient } = renderSse();
    queryClient.setQueryData(documentKeys.list(EMAIL), [buildDocument()]);
    queryClient.setQueryData(documentKeys.search(EMAIL, 'revenue'), {
      total: 1,
      hits: [],
    });

    latestStream().dispatch('document', buildDocument({ status: 'INDEXED' }));

    expect(
      queryClient.getQueryState(documentKeys.list(EMAIL))?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(documentKeys.search(EMAIL, 'revenue'))
        ?.isInvalidated,
    ).toBe(true);
  });
});
