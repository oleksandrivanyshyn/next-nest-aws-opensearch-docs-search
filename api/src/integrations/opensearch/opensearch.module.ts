import { Module } from '@nestjs/common';
import { OPENSEARCH_CLIENT, openSearchProvider } from './opensearch.provider';

@Module({
  providers: [openSearchProvider],
  exports: [OPENSEARCH_CLIENT],
})
export class OpenSearchModule {}
