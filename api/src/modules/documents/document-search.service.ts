import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { OPENSEARCH_CLIENT } from '../../integrations/opensearch/opensearch.provider';
import {
  DOCUMENTS_INDEX,
  DOCUMENTS_INDEX_DEFINITION,
  HIGHLIGHT_POST_TAG,
  HIGHLIGHT_PRE_TAG,
  SEARCH_RESULT_SIZE,
} from './search.constants';
import { IndexedDocument } from './types/indexed-document.type';
import { SearchHit } from './types/search-hit.type';

interface RawHit {
  _score: number | null;
  _source: Pick<IndexedDocument, 'documentId' | 'userFilename' | 'createdAt'>;
  highlight?: Record<string, string[]>;
}

@Injectable()
export class DocumentSearchService implements OnModuleInit {
  private readonly logger = new Logger(DocumentSearchService.name);
  private indexReady = false;

  constructor(@Inject(OPENSEARCH_CLIENT) private readonly client: Client) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureIndex();
      this.indexReady = true;
    } catch (error) {
      this.logger.error(
        'Index bootstrap failed, will retry before the first write',
        error,
      );
    }
  }

  async ensureIndex(): Promise<void> {
    const { body: exists } = await this.client.indices.exists({
      index: DOCUMENTS_INDEX,
    });
    if (exists) {
      this.logger.log(`Index "${DOCUMENTS_INDEX}" already exists`);
      return;
    }

    await this.client.indices.create({
      index: DOCUMENTS_INDEX,
      body: DOCUMENTS_INDEX_DEFINITION,
    });

    this.logger.log(`Created index "${DOCUMENTS_INDEX}"`);
  }

  async indexDocument(document: IndexedDocument): Promise<void> {
    if (!this.indexReady) {
      await this.ensureIndex();
      this.indexReady = true;
    }

    await this.client.index({
      index: DOCUMENTS_INDEX,
      id: document.documentId,
      body: document,
      refresh: 'wait_for',
    });
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.client.delete(
      { index: DOCUMENTS_INDEX, id: documentId },
      { ignore: [404] },
    );
  }

  async search(email: string, query: string): Promise<SearchHit[]> {
    const { body } = await this.client.search({
      index: DOCUMENTS_INDEX,
      body: {
        size: SEARCH_RESULT_SIZE,
        _source: ['documentId', 'userFilename', 'createdAt'],
        query: {
          bool: {
            filter: [{ term: { userEmail: email } }],
            must: [
              {
                multi_match: {
                  query,
                  fields: ['content', 'userFilename^2'],
                  fuzziness: 'AUTO',
                  prefix_length: 1,
                  max_expansions: 50,
                },
              },
            ],
          },
        },
        highlight: {
          pre_tags: [HIGHLIGHT_PRE_TAG],
          post_tags: [HIGHLIGHT_POST_TAG],
          fields: {
            content: { fragment_size: 160, number_of_fragments: 3 },
            userFilename: { number_of_fragments: 0 },
          },
        },
      },
    });

    const hits = body.hits.hits as unknown as RawHit[];

    return hits.map((hit) => ({
      documentId: hit._source.documentId,
      userFilename: hit._source.userFilename,
      createdAt: hit._source.createdAt,
      score: hit._score ?? 0,
      highlights: [
        ...(hit.highlight?.content ?? []),
        ...(hit.highlight?.userFilename ?? []),
      ],
    }));
  }
}
