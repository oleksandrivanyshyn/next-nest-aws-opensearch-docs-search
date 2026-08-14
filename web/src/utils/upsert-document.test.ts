import { upsertDocument } from './upsert-document';
import type { DocumentDto } from '@/types/document.types';

const buildDocument = (
  id: string,
  overrides: Partial<DocumentDto> = {},
): DocumentDto => ({
  id,
  userFilename: `${id}.pdf`,
  status: 'PENDING',
  errorMessage: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('upsertDocument', () => {
  it('prepends a document it has never seen', () => {
    const result = upsertDocument([buildDocument('a')], buildDocument('b'));

    expect(result.map((document) => document.id)).toEqual(['b', 'a']);
  });

  it('replaces an existing document in place rather than moving it', () => {
    const result = upsertDocument(
      [buildDocument('a'), buildDocument('b')],
      buildDocument('b', { status: 'INDEXED' }),
    );

    expect(result.map((document) => document.id)).toEqual(['a', 'b']);
    expect(result[1].status).toBe('INDEXED');
  });

  it('does not mutate the list it was given', () => {
    const documents = [buildDocument('a')];

    upsertDocument(documents, buildDocument('a', { status: 'INDEXED' }));

    expect(documents[0].status).toBe('PENDING');
  });
});
