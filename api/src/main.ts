import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigType } from '@nestjs/config';
import { AppModule } from './app.module';
import { serverConfig } from './config/server.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const server = app.get<ConfigType<typeof serverConfig>>(serverConfig.KEY);

  await app.listen(server.port);
  Logger.log(`API listening on http://localhost:${server.port}`, 'Bootstrap');
}

void bootstrap();
