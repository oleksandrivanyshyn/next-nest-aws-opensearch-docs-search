import { Module } from '@nestjs/common';
import { AwsModule } from '../../integrations/aws/aws.module';
import { OpenSearchModule } from '../../integrations/opensearch/opensearch.module';
import { DocumentSearchService } from './document-search.service';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AwsModule, OpenSearchModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository, DocumentSearchService],
  exports: [DocumentsRepository, DocumentSearchService],
})
export class DocumentsModule {}
