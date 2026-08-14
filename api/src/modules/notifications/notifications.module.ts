import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { SseService } from './sse.service';

@Module({
  controllers: [NotificationsController],
  providers: [SseService],
  exports: [SseService],
})
export class NotificationsModule {}
