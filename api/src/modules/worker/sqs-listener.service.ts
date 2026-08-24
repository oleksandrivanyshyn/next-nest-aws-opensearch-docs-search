import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Message } from '@aws-sdk/client-sqs';
import { SqsService } from '../../integrations/aws/sqs.service';
import {
  S3EventNotification,
  decodeS3Key,
  isObjectCreated,
  isTestEvent,
} from '../../integrations/aws/s3-event';
import { DocumentProcessorService } from './document-processor.service';

const ERROR_BACKOFF_MS = 5_000;

@Injectable()
export class SqsListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsListenerService.name);
  private readonly abort = new AbortController();
  private running = false;
  private loop: Promise<void> = Promise.resolve();

  constructor(
    private readonly sqs: SqsService,
    private readonly processor: DocumentProcessorService,
  ) {}

  onModuleInit(): void {
    this.running = true;
    this.loop = this.poll();
    this.logger.log('SQS listener started');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Stopping SQS listener');
    this.running = false;
    this.abort.abort();
    await this.loop;
    this.logger.log('SQS listener stopped');
  }

  async handleMessage(message: Message): Promise<void> {
    if (!message.Body || !message.ReceiptHandle) return;

    try {
      const payload = JSON.parse(message.Body) as S3EventNotification;

      if (isTestEvent(payload)) {
        this.logger.log('Discarding s3:TestEvent');
        await this.sqs.deleteMessage(message.ReceiptHandle);
        return;
      }

      if (!isObjectCreated(payload)) {
        this.logger.error(
          `Unrecognised SQS payload, leaving on queue: ${message.Body}`,
        );
        return;
      }

      for (const record of payload.Records) {
        await this.processor.process(decodeS3Key(record.s3.object.key));
      }

      await this.sqs.deleteMessage(message.ReceiptHandle);
    } catch (error) {
      this.logger.error(
        'Message processing failed, leaving on queue',
        error as Error,
      );
    }
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const messages = await this.sqs.receive(this.abort.signal);
        for (const message of messages) {
          if (!this.running) break;
          await this.handleMessage(message);
        }
      } catch (error) {
        if (!this.running) return;
        this.logger.error('Poll cycle failed', error as Error);
        await this.sleep(ERROR_BACKOFF_MS);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
