import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { UserScopeDto } from '../documents/dto/requests/user-scope.dto';
import { SseService } from './sse.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly sse: SseService) {}

  @Sse('sse')
  stream(@Query() query: UserScopeDto): Observable<MessageEvent> {
    return this.sse.subscribe(query.email);
  }
}
