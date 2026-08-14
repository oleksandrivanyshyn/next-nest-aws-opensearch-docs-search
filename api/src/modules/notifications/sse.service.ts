import {
  Injectable,
  Logger,
  MessageEvent,
  OnModuleDestroy,
} from '@nestjs/common';
import { Observable, Subject, finalize, interval, map, merge } from 'rxjs';
import type { DocumentResponseDto } from '../documents/dto/responses/document.dto';

const HEARTBEAT_MS = 15_000;

interface StreamEntry {
  subject: Subject<MessageEvent>;
  refs: number;
}

@Injectable()
export class SseService implements OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);
  private readonly streams = new Map<string, StreamEntry>();

  subscribe(email: string): Observable<MessageEvent> {
    const entry = this.streams.get(email) ?? this.createEntry(email);
    entry.refs += 1;
    this.logger.log(`SSE subscribe ${email} (${entry.refs} open)`);

    const heartbeat$ = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: { t: Date.now() } })),
    );

    return merge(entry.subject.asObservable(), heartbeat$).pipe(
      finalize(() => this.release(email)),
    );
  }

  emit(email: string, document: DocumentResponseDto): void {
    const entry = this.streams.get(email);
    if (!entry) {
      this.logger.debug(`No open stream for ${email}, dropping event`);
      return;
    }
    entry.subject.next({ type: 'document', data: document });
  }

  onModuleDestroy(): void {
    for (const entry of this.streams.values()) {
      entry.subject.complete();
    }
    this.streams.clear();
  }

  private createEntry(email: string): StreamEntry {
    const entry: StreamEntry = {
      subject: new Subject<MessageEvent>(),
      refs: 0,
    };
    this.streams.set(email, entry);
    return entry;
  }

  private release(email: string): void {
    const entry = this.streams.get(email);
    if (!entry) return;

    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.subject.complete();
      this.streams.delete(email);
      this.logger.log(`SSE closed for ${email}`);
    }
  }
}
