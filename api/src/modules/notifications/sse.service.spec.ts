import { Logger, MessageEvent } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { SseService } from './sse.service';
import { DocumentResponseDto } from '../documents/dto/responses/document.dto';
import type { DocumentRow } from '../../core/db/drizzle/types';

const OWNER = 'owner@example.com';
const OTHER = 'other@example.com';

const buildDto = (): DocumentResponseDto =>
  DocumentResponseDto.fromRow({
    id: '11111111-1111-4111-8111-111111111111',
    userEmail: OWNER,
    userFilename: 'report.pdf',
    s3Key: 'uploads/a.pdf',
    status: 'INDEXED',
    errorMessage: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } satisfies DocumentRow);

describe('SseService', () => {
  let service: SseService;
  let subscriptions: Subscription[];

  const listen = (email: string): MessageEvent[] => {
    const received: MessageEvent[] = [];
    subscriptions.push(
      service.subscribe(email).subscribe((event) => received.push(event)),
    );
    return received;
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    service = new SseService();
    subscriptions = [];
  });

  afterEach(() => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
  });

  it('delivers a document event to the subscriber for that email', () => {
    const received = listen(OWNER);

    service.emit(OWNER, buildDto());

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('document');
  });

  it('never delivers one user event to another user stream', () => {
    const owner = listen(OWNER);
    const other = listen(OTHER);

    service.emit(OWNER, buildDto());

    expect(owner).toHaveLength(1);
    expect(other).toHaveLength(0);
  });

  it('drops the event when nobody is listening', () => {
    expect(() => service.emit(OWNER, buildDto())).not.toThrow();
  });

  it('fans one event out to every open tab for the same email', () => {
    const firstTab = listen(OWNER);
    const secondTab = listen(OWNER);

    service.emit(OWNER, buildDto());

    expect(firstTab).toHaveLength(1);
    expect(secondTab).toHaveLength(1);
  });

  it('keeps the stream alive for the remaining tab when one closes', () => {
    const firstTab = listen(OWNER);
    const secondTab = listen(OWNER);

    subscriptions.shift()?.unsubscribe();
    service.emit(OWNER, buildDto());

    expect(firstTab).toHaveLength(0);
    expect(secondTab).toHaveLength(1);
  });

  it('forgets the email once the last subscriber leaves', () => {
    const received = listen(OWNER);
    subscriptions.pop()?.unsubscribe();

    service.emit(OWNER, buildDto());

    expect(received).toHaveLength(0);
    expect(listen(OWNER)).toHaveLength(0);
  });
});

describe('SseService heartbeat', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits a ping while the stream is idle', () => {
    const service = new SseService();
    const received: MessageEvent[] = [];
    const subscription = service
      .subscribe(OWNER)
      .subscribe((event) => received.push(event));

    jest.advanceTimersByTime(15_000);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('ping');

    subscription.unsubscribe();
  });
});
