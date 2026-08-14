import { useDocumentsStore } from './documents-store';
import type { DocumentDto } from '@/lib/types';

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

const documentsIn = (): DocumentDto[] => useDocumentsStore.getState().documents;

describe('documents store', () => {
  beforeEach(() => {
    useDocumentsStore.getState().setDocuments([]);
  });

  it('prepends a document it has never seen', () => {
    useDocumentsStore.getState().setDocuments([buildDocument('a')]);

    useDocumentsStore.getState().upsert(buildDocument('b'));

    expect(documentsIn().map((document) => document.id)).toEqual(['b', 'a']);
  });

  it('replaces an existing document in place rather than moving it', () => {
    useDocumentsStore
      .getState()
      .setDocuments([buildDocument('a'), buildDocument('b')]);

    useDocumentsStore
      .getState()
      .upsert(buildDocument('b', { status: 'INDEXED' }));

    const documents = documentsIn();
    expect(documents.map((document) => document.id)).toEqual(['a', 'b']);
    expect(documents[1].status).toBe('INDEXED');
  });

  it('removes only the requested document', () => {
    useDocumentsStore
      .getState()
      .setDocuments([buildDocument('a'), buildDocument('b')]);

    useDocumentsStore.getState().remove('a');

    expect(documentsIn().map((document) => document.id)).toEqual(['b']);
  });
});
