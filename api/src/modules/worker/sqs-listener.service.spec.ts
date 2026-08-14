import { Logger } from '@nestjs/common';
import { SqsListenerService } from './sqs-listener.service';
import { SqsService } from '../../integrations/aws/sqs.service';
import { DocumentProcessorService } from './document-processor.service';

const RECEIPT = 'receipt-handle';

const objectCreated = (key: string): string =>
  JSON.stringify({
    Records: [
      {
        eventName: 'ObjectCreated:Put',
        s3: { bucket: { name: 'bucket' }, object: { key, size: 10 } },
      },
    ],
  });

describe('SqsListenerService.handleMessage', () => {
  let sqs: jest.Mocked<SqsService>;
  let processor: jest.Mocked<DocumentProcessorService>;
  let service: SqsListenerService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    sqs = {
      receive: jest.fn(),
      deleteMessage: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SqsService>;

    processor = {
      process: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DocumentProcessorService>;

    service = new SqsListenerService(sqs, processor);
  });

  it('processes the decoded key and then deletes the message', async () => {
    await service.handleMessage({
      Body: objectCreated('uploads/my+report.pdf'),
      ReceiptHandle: RECEIPT,
    });

    expect(processor.process).toHaveBeenCalledWith('uploads/my report.pdf');
    expect(sqs.deleteMessage).toHaveBeenCalledWith(RECEIPT);
  });

  it('discards the s3:TestEvent without calling the processor', async () => {
    await service.handleMessage({
      Body: JSON.stringify({ Event: 's3:TestEvent' }),
      ReceiptHandle: RECEIPT,
    });

    expect(processor.process).not.toHaveBeenCalled();
    expect(sqs.deleteMessage).toHaveBeenCalledWith(RECEIPT);
  });

  it('leaves the message on the queue when processing throws', async () => {
    processor.process.mockRejectedValue(new Error('ConnectionError'));

    await service.handleMessage({
      Body: objectCreated('uploads/a.pdf'),
      ReceiptHandle: RECEIPT,
    });

    expect(sqs.deleteMessage).not.toHaveBeenCalled();
  });

  it('leaves the message on the queue when the body is not valid json', async () => {
    await service.handleMessage({ Body: 'not json', ReceiptHandle: RECEIPT });

    expect(sqs.deleteMessage).not.toHaveBeenCalled();
  });

  it('ignores a message with no body or receipt handle', async () => {
    await service.handleMessage({});

    expect(processor.process).not.toHaveBeenCalled();
    expect(sqs.deleteMessage).not.toHaveBeenCalled();
  });
});
