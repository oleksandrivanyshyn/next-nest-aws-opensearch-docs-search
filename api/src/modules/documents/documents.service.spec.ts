import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { DocumentSearchService } from './document-search.service';
import { S3Service } from '../../integrations/aws/s3.service';
import type { DocumentRow } from '../../core/db/drizzle/types';
import type { SearchHit } from './types/search-hit.type';

const OWNER = 'owner@example.com';
const DOC_ID = '11111111-1111-4111-8111-111111111111';

const buildRow = (overrides: Partial<DocumentRow> = {}): DocumentRow => ({
  id: DOC_ID,
  userEmail: OWNER,
  userFilename: 'report.pdf',
  s3Key: `uploads/${DOC_ID}.pdf`,
  status: 'PENDING',
  errorMessage: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const buildHit = (documentId: string): SearchHit => ({
  documentId,
  userFilename: 'report.pdf',
  createdAt: '2026-01-01T00:00:00.000Z',
  score: 1,
  highlights: ['[[HL]]revenue[[/HL]]'],
});

describe('DocumentsService', () => {
  let repository: jest.Mocked<DocumentsRepository>;
  let s3: jest.Mocked<S3Service>;
  let documentSearch: jest.Mocked<DocumentSearchService>;
  let service: DocumentsService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findAllByEmail: jest.fn(),
      findById: jest.fn(),
      findByS3Key: jest.fn(),
      findManyByIds: jest.fn(),
      updateStatus: jest.fn(),
      deleteById: jest.fn(),
    } as unknown as jest.Mocked<DocumentsRepository>;

    s3 = {
      createPresignedPutUrl: jest.fn().mockResolvedValue('https://signed'),
      head: jest.fn(),
      download: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<S3Service>;

    documentSearch = {
      search: jest.fn(),
      indexDocument: jest.fn(),
      deleteDocument: jest.fn(),
    } as unknown as jest.Mocked<DocumentSearchService>;

    service = new DocumentsService(repository, s3, documentSearch);
  });

  describe('createUploadUrl', () => {
    it('derives the s3 key extension from the content type, not the filename casing', async () => {
      repository.create.mockResolvedValue(buildRow());

      await service.createUploadUrl({
        email: OWNER,
        filename: 'REPORT.PDF',
        contentType: 'application/pdf',
        size: 1024,
      });

      const [created] = repository.create.mock.calls[0];
      expect(created.s3Key).toMatch(/^uploads\/[0-9a-f-]{36}\.pdf$/);
      expect(created.status).toBe('PENDING');
    });

    it('maps the docx content type to a .docx key', async () => {
      repository.create.mockResolvedValue(buildRow());

      await service.createUploadUrl({
        email: OWNER,
        filename: 'report.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1024,
      });

      const [created] = repository.create.mock.calls[0];
      expect(created.s3Key).toMatch(/\.docx$/);
    });

    it('rejects a filename whose extension does not match the content type', async () => {
      await expect(
        service.createUploadUrl({
          email: OWNER,
          filename: 'totally-not-a.exe',
          contentType: 'application/pdf',
          size: 1024,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a pdf filename declared with the docx content type', async () => {
      await expect(
        service.createUploadUrl({
          email: OWNER,
          filename: 'report.pdf',
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('search', () => {
    it('drops hits whose row no longer exists', async () => {
      documentSearch.search.mockResolvedValue([
        buildHit(DOC_ID),
        buildHit('22222222-2222-4222-8222-222222222222'),
      ]);
      repository.findManyByIds.mockResolvedValue([buildRow()]);

      const result = await service.search(OWNER, 'revenue');

      expect(result.total).toBe(1);
      expect(result.hits[0].documentId).toBe(DOC_ID);
    });

    it('scopes the row lookup to the requesting user', async () => {
      documentSearch.search.mockResolvedValue([buildHit(DOC_ID)]);
      repository.findManyByIds.mockResolvedValue([]);

      await service.search(OWNER, 'revenue');

      expect(repository.findManyByIds).toHaveBeenCalledWith([DOC_ID], OWNER);
    });

    it('returns an empty result when the index matches nothing', async () => {
      documentSearch.search.mockResolvedValue([]);
      repository.findManyByIds.mockResolvedValue([]);

      await expect(service.search(OWNER, 'revenue')).resolves.toEqual({
        total: 0,
        hits: [],
      });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the document does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(service.remove(DOC_ID, OWNER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the document belongs to someone else', async () => {
      repository.findById.mockResolvedValue(buildRow());

      await expect(
        service.remove(DOC_ID, 'intruder@example.com'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('leaves S3 and the index untouched when ownership fails', async () => {
      repository.findById.mockResolvedValue(buildRow());

      await expect(
        service.remove(DOC_ID, 'intruder@example.com'),
      ).rejects.toThrow(ForbiddenException);

      expect(s3.delete).not.toHaveBeenCalled();
      expect(documentSearch.deleteDocument).not.toHaveBeenCalled();
      expect(repository.deleteById).not.toHaveBeenCalled();
    });

    it('removes the row, the object, and the index entry', async () => {
      repository.findById.mockResolvedValue(buildRow());

      await service.remove(DOC_ID, OWNER);

      expect(repository.deleteById).toHaveBeenCalledWith(DOC_ID);
      expect(s3.delete).toHaveBeenCalledWith(`uploads/${DOC_ID}.pdf`);
      expect(documentSearch.deleteDocument).toHaveBeenCalledWith(DOC_ID);
    });

    it('deletes the stored content before the row, so a failed cleanup cannot leave an orphan', async () => {
      repository.findById.mockResolvedValue(buildRow());

      await service.remove(DOC_ID, OWNER);

      const [rowDeleted] = repository.deleteById.mock.invocationCallOrder;
      const [objectDeleted] = s3.delete.mock.invocationCallOrder;
      const [indexDeleted] =
        documentSearch.deleteDocument.mock.invocationCallOrder;

      expect(objectDeleted).toBeLessThan(rowDeleted);
      expect(indexDeleted).toBeLessThan(rowDeleted);
    });
  });
});
