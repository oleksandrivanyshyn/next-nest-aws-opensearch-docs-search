import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigType } from '@nestjs/config';
import { AppModule } from './app.module';
import { serverConfig } from './config/server.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const server = app.get<ConfigType<typeof serverConfig>>(serverConfig.KEY);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: server.corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();

  await app.listen(server.port);
  Logger.log(
    `API listening on http://localhost:${server.port}/api`,
    'Bootstrap',
  );
}

void bootstrap();
