import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { awsConfig } from './config/aws.config';
import { databaseConfig } from './config/database.config';
import { searchConfig } from './config/search.config';
import { serverConfig } from './config/server.config';
import { DrizzleModule } from './core/db/drizzle/drizzle.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { WorkerModule } from './modules/worker/worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [serverConfig, databaseConfig, awsConfig, searchConfig],
    }),
    DrizzleModule,
    DocumentsModule,
    WorkerModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
