import { Logger } from '@nestjs/common';
import { DocumentProcessorService } from './document-processor.service';
import { DocumentsRepository } from '../documents/documents.repository';
import { DocumentSearchService } from '../documents/document-search.service';
import { S3Service } from '../../integrations/aws/s3.service';
import { ParserService } from '../parsing/parser.service';
import { SseService } from '../notifications/sse.service';
import {
  TextExtractionError,
  UnsupportedFileTypeError,
} from '../parsing/parsing.errors';
import { MAX_FILE_SIZE_BYTES } from '../documents/documents.constants';
import type { DocumentRow } from '../../core/db/drizzle/types';

const S3_KEY = 'uploads/11111111-1111-4111-8111-111111111111.pdf';
const DOC_ID = '11111111-1111-4111-8111-111111111111';

const buildRow = (overrides: Partial<DocumentRow> = {}): DocumentRow => ({
  id: DOC_ID,
  userEmail: 'owner@example.com',
  userFilename: 'report.pdf',
  s3Key: S3_KEY,
  status: 'PENDING',
  errorMessage: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('DocumentProcessorService', () => {
  let repository: jest.Mocked<DocumentsRepository>;
  let s3: jest.Mocked<S3Service>;
  let parser: jest.Mocked<ParserService>;
  let documentSearch: jest.Mocked<DocumentSearchService>;
  let sse: jest.Mocked<SseService>;
  let service: DocumentProcessorService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    repository = {
      findByS3Key: jest.fn().mockResolvedValue(buildRow()),
      updateStatus: jest.fn().mockResolvedValue(buildRow()),
    } as unknown as jest.Mocked<DocumentsRepository>;

    s3 = {
      head: jest.fn().mockResolvedValue({
        contentLength: 1024,
        contentType: 'application/pdf',
      }),
      download: jest.fn().mockResolvedValue(Buffer.from('pdf bytes')),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<S3Service>;

    parser = {
      extract: jest.fn().mockResolvedValue('extracted text'),
    } as unknown as jest.Mocked<ParserService>;

    documentSearch = {
      indexDocument: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DocumentSearchService>;

    sse = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<SseService>;

    service = new DocumentProcessorService(
      repository,
      s3,
      parser,
      documentSearch,
      sse,
    );
  });

  describe('happy path', () => {
    it('indexes the extracted text and flips the row to INDEXED', async () => {
      await service.process(S3_KEY);

      expect(documentSearch.indexDocument).toHaveBeenCalledWith({
        documentId: DOC_ID,
        userEmail: 'owner@example.com',
        userFilename: 'report.pdf',
        content: 'extracted text',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(repository.updateStatus).toHaveBeenCalledWith(DOC_ID, 'INDEXED');
    });

    it('pushes the updated document to the owner over SSE', async () => {
      repository.updateStatus.mockResolvedValue(
        buildRow({ status: 'INDEXED' }),
      );

      await service.process(S3_KEY);

      expect(sse.emit).toHaveBeenCalledWith(
        'owner@example.com',
        expect.objectContaining({ id: DOC_ID, status: 'INDEXED' }),
      );
    });
  });

  describe('early returns', () => {
    it('skips an object with no matching row', async () => {
      repository.findByS3Key.mockResolvedValue(undefined);

      await service.process(S3_KEY);

      expect(s3.download).not.toHaveBeenCalled();
      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it('skips a redelivery of an already indexed document', async () => {
      repository.findByS3Key.mockResolvedValue(buildRow({ status: 'INDEXED' }));

      await service.process(S3_KEY);

      expect(documentSearch.indexDocument).not.toHaveBeenCalled();
      expect(repository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('permanent failures', () => {
    it('marks ERROR and swallows when the stored object exceeds the size cap', async () => {
      s3.head.mockResolvedValue({
        contentLength: MAX_FILE_SIZE_BYTES + 1,
        contentType: 'application/pdf',
      });

      await expect(service.process(S3_KEY)).resolves.toBeUndefined();

      expect(s3.delete).toHaveBeenCalledWith(S3_KEY);
      expect(repository.updateStatus).toHaveBeenCalledWith(
        DOC_ID,
        'ERROR',
        expect.stringContaining('limit is'),
      );
    });

    it('never pulls an oversized object into memory', async () => {
      s3.head.mockResolvedValue({
        contentLength: MAX_FILE_SIZE_BYTES + 1,
        contentType: 'application/pdf',
      });

      await service.process(S3_KEY);

      expect(s3.download).not.toHaveBeenCalled();
      expect(parser.extract).not.toHaveBeenCalled();
    });

    it('rejects an object stored at exactly the size cap', async () => {
      s3.head.mockResolvedValue({
        contentLength: MAX_FILE_SIZE_BYTES,
        contentType: 'application/pdf',
      });

      await service.process(S3_KEY);

      expect(s3.download).not.toHaveBeenCalled();
      expect(repository.updateStatus).toHaveBeenCalledWith(
        DOC_ID,
        'ERROR',
        expect.stringContaining('limit is'),
      );
    });

    it('marks ERROR when the stored content type is not allowed', async () => {
      s3.head.mockResolvedValue({
        contentLength: 1024,
        contentType: 'application/zip',
      });

      await expect(service.process(S3_KEY)).resolves.toBeUndefined();

      expect(repository.updateStatus).toHaveBeenCalledWith(
        DOC_ID,
        'ERROR',
        expect.stringContaining('application/zip'),
      );
    });

    it('marks ERROR when S3 reports no content type at all', async () => {
      s3.head.mockResolvedValue({
        contentLength: 1024,
        contentType: undefined,
      });

      await expect(service.process(S3_KEY)).resolves.toBeUndefined();

      expect(parser.extract).not.toHaveBeenCalled();
      expect(repository.updateStatus).toHaveBeenCalledWith(
        DOC_ID,
        'ERROR',
        expect.stringContaining('Unsupported content type'),
      );
    });

    it('marks ERROR when extraction yields no text', async () => {
      parser.extract.mockResolvedValue('');

      await expect(service.process(S3_KEY)).resolves.toBeUndefined();

      expect(documentSearch.indexDocument).not.toHaveBeenCalled();
      expect(repository.updateStatus).toHaveBeenCalledWith(
        DOC_ID,
        'ERROR',
        expect.stringContaining('No extractable text'),
      );
    });

    it('pushes the ERROR status to the owner over SSE', async () => {
      parser.extract.mockResolvedValue('');
      repository.updateStatus.mockResolvedValue(
        buildRow({ status: 'ERROR', errorMessage: 'No extractable text' }),
      );

      await service.process(S3_KEY);

      expect(sse.emit).toHaveBeenCalledWith(
        'owner@example.com',
        expect.objectContaining({ status: 'ERROR' }),
      );
    });

    it('treats a parser failure as permanent', async () => {
      parser.extract.mockRejectedValue(
        new TextExtractionError('Failed to parse PDF'),
      );

      await expect(service.process(S3_KEY)).resolves.toBeUndefined();

      expect(repository.updateStatus).toHaveBeenCalledWith(
        DOC_ID,
        'ERROR',
        'Failed to parse PDF',
      );
    });

    it('treats an extension the parser cannot dispatch as permanent', async () => {
      parser.extract.mockRejectedValue(new UnsupportedFileTypeError('.png'));

      await expect(service.process(S3_KEY)).resolves.toBeUndefined();

      expect(repository.updateStatus).toHaveBeenCalledWith(
        DOC_ID,
        'ERROR',
        'Unsupported file type: .png',
      );
    });
  });

  describe('notification failures', () => {
    it('does not turn a failed SSE push into a transient failure', async () => {
      sse.emit.mockImplementation(() => {
        throw new Error('stream exploded');
      });

      await expect(service.process(S3_KEY)).resolves.toBeUndefined();

      expect(repository.updateStatus).toHaveBeenCalledWith(DOC_ID, 'INDEXED');
    });
  });

  describe('transient failures', () => {
    it('rethrows and leaves the status alone when indexing fails', async () => {
      documentSearch.indexDocument.mockRejectedValue(
        new Error('ConnectionError'),
      );

      await expect(service.process(S3_KEY)).rejects.toThrow('ConnectionError');

      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it('rethrows when S3 download fails', async () => {
      s3.download.mockRejectedValue(new Error('SlowDown'));

      await expect(service.process(S3_KEY)).rejects.toThrow('SlowDown');

      expect(repository.updateStatus).not.toHaveBeenCalled();
    });
  });
});
