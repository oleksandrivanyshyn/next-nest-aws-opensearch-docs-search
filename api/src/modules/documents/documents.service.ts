import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { S3Service } from '../../integrations/aws/s3.service';
import { DocumentSearchService } from './document-search.service';
import { ALLOWED_MIME_MAP, UPLOAD_PREFIX } from './documents.constants';
import { DocumentRow } from '../../core/db/drizzle/types';
import { CreateUploadUrlDto } from './dto/requests/create-upload-url.dto';
import { DocumentResponseDto } from './dto/responses/document.dto';
import type { UploadUrlResponse } from './dto/responses/upload-url.dto';
import type { SearchResponse } from './dto/responses/search.dto';
import { DocumentsRepository } from './documents.repository';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly repository: DocumentsRepository,
    private readonly s3: S3Service,
    private readonly documentSearch: DocumentSearchService,
  ) {}

  async createUploadUrl(dto: CreateUploadUrlDto): Promise<UploadUrlResponse> {
    const expectedExtension = ALLOWED_MIME_MAP[dto.contentType];
    if (extname(dto.filename).toLowerCase() !== expectedExtension) {
      throw new BadRequestException(
        `filename extension does not match contentType ${dto.contentType}`,
      );
    }

    const id = randomUUID();
    const s3Key = `${UPLOAD_PREFIX}${id}${expectedExtension}`;

    const document = await this.repository.create({
      id,
      userEmail: dto.email,
      userFilename: dto.filename,
      s3Key,
      status: 'PENDING',
    });

    const uploadUrl = await this.s3.createPresignedPutUrl(
      s3Key,
      dto.contentType,
      dto.size,
    );

    return {
      uploadUrl,
      requiredHeaders: {
        'Content-Type': dto.contentType,
        'Content-Length': String(dto.size),
      },
      document: DocumentResponseDto.fromRow(document),
    };
  }

  async list(email: string): Promise<DocumentResponseDto[]> {
    const rows = await this.repository.findAllByEmail(email);
    return DocumentResponseDto.fromRows(rows);
  }

  async search(email: string, query: string): Promise<SearchResponse> {
    const hits = await this.documentSearch.search(email, query);

    const rows = await this.repository.findManyByIds(
      hits.map((hit) => hit.documentId),
      email,
    );
    const alive = new Set(rows.map((row) => row.id));
    const filtered = hits.filter((hit) => alive.has(hit.documentId));

    return { total: filtered.length, hits: filtered };
  }

  async remove(id: string, email: string): Promise<void> {
    const row = await this.requireOwned(id, email);
    await this.repository.deleteById(row.id);
    await this.s3.delete(row.s3Key);
    await this.documentSearch.deleteDocument(row.id);

    this.logger.log(`Deleted document ${id}`);
  }

  private async requireOwned(id: string, email: string): Promise<DocumentRow> {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundException('Document not found');
    if (row.userEmail !== email) {
      throw new ForbiddenException('Document belongs to another user');
    }
    return row;
  }
}
