import { Controller, MessageEvent, Query, Res, Sse } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { UserScopeDto } from '../documents/dto/requests/user-scope.dto';
import { SseService } from './sse.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly sse: SseService) {}

  @Sse('sse')
  stream(
    @Query() query: UserScopeDto,
    @Res({ passthrough: true }) response: Response,
  ): Observable<MessageEvent> {
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
    response.setHeader('Connection', 'keep-alive');

    return this.sse.subscribe(query.email);
  }
}
