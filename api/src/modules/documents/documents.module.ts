import { Module } from '@nestjs/common';
import { AwsModule } from '../../integrations/aws/aws.module';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AwsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository],
  exports: [DocumentsRepository],
})
export class DocumentsModule {}
