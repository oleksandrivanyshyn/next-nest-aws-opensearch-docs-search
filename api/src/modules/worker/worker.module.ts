import { Module } from '@nestjs/common';
import { AwsModule } from '../../integrations/aws/aws.module';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParsingModule } from '../parsing/parsing.module';
import { DocumentProcessorService } from './document-processor.service';
import { SqsListenerService } from './sqs-listener.service';

@Module({
  imports: [AwsModule, DocumentsModule, NotificationsModule, ParsingModule],
  providers: [SqsListenerService, DocumentProcessorService],
})
export class WorkerModule {}
