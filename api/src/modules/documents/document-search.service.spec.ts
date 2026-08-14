import { Logger } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { DocumentSearchService } from './document-search.service';
import { DOCUMENTS_INDEX } from './search.constants';

interface SearchRequestBody {
  query: {
    bool: {
      filter: { term: { userEmail: string } }[];
      must: { multi_match: { fuzziness: string; fields: string[] } }[];
    };
  };
  highlight: { pre_tags: string[]; post_tags: string[] };
}

interface ClientMocks {
  search: jest.Mock;
  index: jest.Mock;
  delete: jest.Mock;
  exists: jest.Mock;
  create: jest.Mock;
}

const EMAIL = 'owner@example.com';

const buildClient = (
  overrides: Partial<ClientMocks> = {},
): { client: Client; mocks: ClientMocks } => {
  const mocks: ClientMocks = {
    search: jest.fn().mockResolvedValue({ body: { hits: { hits: [] } } }),
    index: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    exists: jest.fn().mockResolvedValue({ body: false }),
    create: jest.fn().mockResolvedValue({}),
    ...overrides,
  };

  const client = {
    search: mocks.search,
    index: mocks.index,
    delete: mocks.delete,
    indices: { exists: mocks.exists, create: mocks.create },
  } as unknown as Client;

  return { client, mocks };
};

const hitFrom = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  _score: 1,
  _source: {
    documentId: 'doc-1',
    userFilename: 'report.pdf',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  ...overrides,
});

describe('DocumentSearchService.search', () => {
  it('scopes the query to the user with a term filter on userEmail', async () => {
    const { client, mocks } = buildClient();

    await new DocumentSearchService(client).search(EMAIL, 'revenue');

    const [request] = mocks.search.mock.calls[0] as [
      { index: string; body: SearchRequestBody },
    ];
    expect(request.index).toBe(DOCUMENTS_INDEX);
    expect(request.body.query.bool.filter).toEqual([
      { term: { userEmail: EMAIL } },
    ]);
  });

  it('asks for fuzzy matching across content and filename', async () => {
    const { client, mocks } = buildClient();

    await new DocumentSearchService(client).search(EMAIL, 'revenue');

    const [request] = mocks.search.mock.calls[0] as [
      { index: string; body: SearchRequestBody },
    ];
    const [match] = request.body.query.bool.must;
    expect(match.multi_match.fuzziness).toBe('AUTO');
    expect(match.multi_match.fields).toEqual(['content', 'userFilename^2']);
  });

  it('merges content and filename highlights into one list', async () => {
    const { client } = buildClient({
      search: jest.fn().mockResolvedValue({
        body: {
          hits: {
            hits: [
              hitFrom({
                _score: 3.5,
                highlight: {
                  content: ['[[HL]]revenue[[/HL]] grew'],
                  userFilename: ['[[HL]]report[[/HL]].pdf'],
                },
              }),
            ],
          },
        },
      }),
    });

    const [hit] = await new DocumentSearchService(client).search(
      EMAIL,
      'revenue',
    );

    expect(hit.highlights).toEqual([
      '[[HL]]revenue[[/HL]] grew',
      '[[HL]]report[[/HL]].pdf',
    ]);
    expect(hit.score).toBe(3.5);
  });

  it('falls back to a zero score and no highlights when both are absent', async () => {
    const { client } = buildClient({
      search: jest.fn().mockResolvedValue({
        body: { hits: { hits: [hitFrom({ _score: null })] } },
      }),
    });

    const [hit] = await new DocumentSearchService(client).search(
      EMAIL,
      'revenue',
    );

    expect(hit.score).toBe(0);
    expect(hit.highlights).toEqual([]);
  });
});

describe('DocumentSearchService index bootstrap', () => {
  it('creates the index when it is missing', async () => {
    const { client, mocks } = buildClient();

    await new DocumentSearchService(client).ensureIndex();

    expect(mocks.create).toHaveBeenCalledTimes(1);
    const [request] = mocks.create.mock.calls[0] as [{ index: string }];
    expect(request.index).toBe(DOCUMENTS_INDEX);
  });

  it('leaves an existing index alone', async () => {
    const { client, mocks } = buildClient({
      exists: jest.fn().mockResolvedValue({ body: true }),
    });

    await new DocumentSearchService(client).ensureIndex();

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('does not throw out of onModuleInit when opensearch is unreachable', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { client } = buildClient({
      exists: jest.fn().mockRejectedValue(new Error('401 Unauthorized')),
    });

    await expect(
      new DocumentSearchService(client).onModuleInit(),
    ).resolves.toBeUndefined();
  });

  it('retries the bootstrap on the first write after a failed start', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const exists = jest
      .fn()
      .mockRejectedValueOnce(new Error('401 Unauthorized'))
      .mockResolvedValue({ body: false });
    const { client, mocks } = buildClient({ exists });

    const service = new DocumentSearchService(client);
    await service.onModuleInit();
    expect(mocks.create).not.toHaveBeenCalled();

    await service.indexDocument({
      documentId: 'doc-1',
      userEmail: EMAIL,
      userFilename: 'report.pdf',
      content: 'revenue',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.index).toHaveBeenCalledTimes(1);
  });

  it('does not re-check the index once the bootstrap succeeded', async () => {
    const { client, mocks } = buildClient();

    const service = new DocumentSearchService(client);
    await service.onModuleInit();

    await service.indexDocument({
      documentId: 'doc-1',
      userEmail: EMAIL,
      userFilename: 'report.pdf',
      content: 'revenue',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(mocks.exists).toHaveBeenCalledTimes(1);
  });
});
