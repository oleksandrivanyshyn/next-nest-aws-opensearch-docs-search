import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from '../../integrations/aws/s3.service';
import { DocumentSearchService } from '../documents/document-search.service';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../documents/documents.constants';
import { DocumentsRepository } from '../documents/documents.repository';
import { ParserService } from '../parsing/parser.service';
import {
  TextExtractionError,
  UnsupportedFileTypeError,
} from '../parsing/parsing.errors';
import { PermanentProcessingError } from './worker.errors';

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);

  constructor(
    private readonly repository: DocumentsRepository,
    private readonly s3: S3Service,
    private readonly parser: ParserService,
    private readonly documentSearch: DocumentSearchService,
  ) {}

  async process(s3Key: string): Promise<void> {
    const row = await this.repository.findByS3Key(s3Key);

    if (!row) {
      this.logger.warn(`No document row for ${s3Key}, skipping orphan object`);
      return;
    }

    if (row.status === 'INDEXED') {
      this.logger.log(`${row.id} already indexed, skipping redelivery`);
      return;
    }

    try {
      const metadata = await this.s3.head(s3Key);

      if (metadata.contentLength > MAX_FILE_SIZE_BYTES) {
        await this.s3.delete(s3Key);
        throw new PermanentProcessingError(
          `File is ${metadata.contentLength} bytes, limit is ${MAX_FILE_SIZE_BYTES}`,
        );
      }

      if (
        metadata.contentType &&
        !(ALLOWED_MIME_TYPES as readonly string[]).includes(
          metadata.contentType,
        )
      ) {
        throw new PermanentProcessingError(
          `Unsupported content type: ${metadata.contentType}`,
        );
      }

      const buffer = await this.s3.download(s3Key);
      const content = await this.parser.extract(buffer, s3Key);

      if (content.length === 0) {
        throw new PermanentProcessingError(
          'No extractable text (the file may be a scanned image)',
        );
      }

      await this.documentSearch.indexDocument({
        documentId: row.id,
        userEmail: row.userEmail,
        userFilename: row.userFilename,
        content,
        createdAt: row.createdAt.toISOString(),
      });

      await this.repository.updateStatus(row.id, 'INDEXED');
      this.logger.log(`Indexed ${row.id} (${content.length} chars)`);
    } catch (error) {
      if (this.isPermanent(error)) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        await this.repository.updateStatus(row.id, 'ERROR', message);
        this.logger.warn(`Permanent failure for ${row.id}: ${message}`);
        return;
      }

      this.logger.error(
        `Transient failure for ${row.id}, will retry`,
        error as Error,
      );
      throw error;
    }
  }

  private isPermanent(error: unknown): boolean {
    return (
      error instanceof PermanentProcessingError ||
      error instanceof UnsupportedFileTypeError ||
      error instanceof TextExtractionError
    );
  }
}
