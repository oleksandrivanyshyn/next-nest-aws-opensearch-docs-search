import { Logger } from '@nestjs/common';
import { Message } from '@aws-sdk/client-sqs';
import { SqsListenerService } from './sqs-listener.service';
import { SqsService } from '../../integrations/aws/sqs.service';
import { DocumentProcessorService } from './document-processor.service';

const RECEIPT = 'receipt-handle';
const BACKOFF_MS = 5_000;

const objectCreated = (key: string): string =>
  JSON.stringify({
    Records: [
      {
        eventName: 'ObjectCreated:Put',
        s3: { bucket: { name: 'bucket' }, object: { key, size: 10 } },
      },
    ],
  });

const messageFor = (key: string): Message => ({
  Body: objectCreated(key),
  ReceiptHandle: RECEIPT,
});

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const silenceLogger = (): void => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
};

describe('SqsListenerService.handleMessage', () => {
  let sqs: jest.Mocked<SqsService>;
  let processor: jest.Mocked<DocumentProcessorService>;
  let service: SqsListenerService;

  beforeEach(() => {
    silenceLogger();

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

  it('leaves an unrecognised payload on the queue instead of discarding it', async () => {
    await service.handleMessage({
      Body: JSON.stringify({ some: 'unexpected shape' }),
      ReceiptHandle: RECEIPT,
    });

    expect(processor.process).not.toHaveBeenCalled();
    expect(sqs.deleteMessage).not.toHaveBeenCalled();
  });

  it('leaves a payload with an empty Records array on the queue', async () => {
    await service.handleMessage({
      Body: JSON.stringify({ Records: [] }),
      ReceiptHandle: RECEIPT,
    });

    expect(processor.process).not.toHaveBeenCalled();
    expect(sqs.deleteMessage).not.toHaveBeenCalled();
  });

  it('ignores a message with no body or receipt handle', async () => {
    await service.handleMessage({});

    expect(processor.process).not.toHaveBeenCalled();
    expect(sqs.deleteMessage).not.toHaveBeenCalled();
  });
});

describe('SqsListenerService polling', () => {
  let sqs: jest.Mocked<SqsService>;
  let processor: jest.Mocked<DocumentProcessorService>;
  let service: SqsListenerService;
  let releaseReceive: (messages: Message[]) => void;

  const parkOnReceive = (): Promise<Message[]> =>
    new Promise<Message[]>((resolve) => {
      releaseReceive = resolve;
    });

  const deliver = async (messages: Message[]): Promise<void> => {
    releaseReceive(messages);
    await flush();
  };

  const shutdown = async (): Promise<void> => {
    const stopping = service.onModuleDestroy();
    releaseReceive([]);
    await stopping;
  };

  beforeEach(async () => {
    silenceLogger();

    sqs = {
      receive: jest.fn().mockImplementation(parkOnReceive),
      deleteMessage: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SqsService>;

    processor = {
      process: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DocumentProcessorService>;

    service = new SqsListenerService(sqs, processor);
    service.onModuleInit();
    await flush();
  });

  it('asks for the next batch as soon as the current one is handled', async () => {
    expect(sqs.receive).toHaveBeenCalledTimes(1);

    await deliver([messageFor('uploads/a.pdf')]);

    expect(processor.process).toHaveBeenCalledWith('uploads/a.pdf');
    expect(sqs.receive).toHaveBeenCalledTimes(2);

    await shutdown();
  });

  it('keeps looping when a batch comes back empty', async () => {
    await deliver([]);

    expect(sqs.receive).toHaveBeenCalledTimes(2);

    await shutdown();
  });

  it('aborts the in-flight long poll on shutdown', async () => {
    const [signal] = sqs.receive.mock.calls[0];
    expect(signal.aborted).toBe(false);

    await shutdown();

    expect(signal.aborted).toBe(true);
  });

  it('waits for the in-flight cycle before reporting itself stopped', async () => {
    let stopped = false;
    const stopping = service.onModuleDestroy().then(() => {
      stopped = true;
    });

    await flush();
    expect(stopped).toBe(false);

    releaseReceive([]);
    await stopping;

    expect(stopped).toBe(true);
    expect(sqs.receive).toHaveBeenCalledTimes(1);
  });

  it('abandons the rest of the batch once shutdown begins', async () => {
    let stopping: Promise<void> = Promise.resolve();
    processor.process.mockImplementationOnce(() => {
      stopping = service.onModuleDestroy();
      return Promise.resolve();
    });

    await deliver([messageFor('uploads/a.pdf'), messageFor('uploads/b.pdf')]);
    await stopping;

    expect(processor.process).toHaveBeenCalledTimes(1);
    expect(sqs.receive).toHaveBeenCalledTimes(1);
  });
});

describe('SqsListenerService poll failures', () => {
  let sqs: jest.Mocked<SqsService>;
  let service: SqsListenerService;
  let releaseReceive: (messages: Message[]) => void;
  let rejectReceive: (error: Error) => void;

  const parkOnReceive = (): Promise<Message[]> =>
    new Promise<Message[]>((resolve, reject) => {
      releaseReceive = resolve;
      rejectReceive = reject;
    });

  const build = (receive: jest.Mock): void => {
    sqs = {
      receive,
      deleteMessage: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SqsService>;

    service = new SqsListenerService(sqs, {
      process: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DocumentProcessorService>);
  };

  beforeEach(() => {
    silenceLogger();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('backs off instead of tight-spinning after a failed cycle', async () => {
    const receive = jest
      .fn()
      .mockRejectedValueOnce(new Error('ConnectionError'))
      .mockImplementation(parkOnReceive);
    build(receive);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    expect(receive).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(BACKOFF_MS - 1);
    expect(receive).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(receive).toHaveBeenCalledTimes(2);

    const stopping = service.onModuleDestroy();
    releaseReceive([]);
    await stopping;
  });

  it('does not sit through a backoff when the failure is the shutdown abort', async () => {
    build(jest.fn().mockImplementation(parkOnReceive));

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);

    const stopping = service.onModuleDestroy();
    rejectReceive(new Error('AbortError'));

    await expect(stopping).resolves.toBeUndefined();
    expect(sqs.receive).toHaveBeenCalledTimes(1);
  });
});
