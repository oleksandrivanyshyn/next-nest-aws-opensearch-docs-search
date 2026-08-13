import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreateUploadUrlDto } from './dto/requests/create-upload-url.dto';
import { SearchDocumentsDto } from './dto/requests/search-documents.dto';
import { UserScopeDto } from './dto/requests/user-scope.dto';
import type { DocumentResponseDto } from './dto/responses/document.dto';
import type { SearchResponse } from './dto/responses/search.dto';
import type { UploadUrlResponse } from './dto/responses/upload-url.dto';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('upload-url')
  createUploadUrl(@Body() dto: CreateUploadUrlDto): Promise<UploadUrlResponse> {
    return this.service.createUploadUrl(dto);
  }

  @Get('search')
  search(@Query() query: SearchDocumentsDto): Promise<SearchResponse> {
    return this.service.search(query.email, query.q);
  }

  @Get()
  list(@Query() query: UserScopeDto): Promise<DocumentResponseDto[]> {
    return this.service.list(query.email);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: UserScopeDto,
  ): Promise<void> {
    return this.service.remove(id, query.email);
  }
}
