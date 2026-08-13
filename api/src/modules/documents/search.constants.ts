export const DOCUMENTS_INDEX = 'documents';

export const HIGHLIGHT_PRE_TAG = '[[HL]]';
export const HIGHLIGHT_POST_TAG = '[[/HL]]';

export const SEARCH_RESULT_SIZE = 20;

export const DOCUMENTS_INDEX_DEFINITION = {
  settings: { number_of_shards: 1, number_of_replicas: 0 },
  mappings: {
    properties: {
      documentId: { type: 'keyword' },
      userEmail: { type: 'keyword' },
      userFilename: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      content: { type: 'text' },
      createdAt: { type: 'date' },
    },
  },
} as const;
