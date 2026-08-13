import { Client } from '@opensearch-project/opensearch';
import { Provider } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { searchConfig } from '../../config/search.config';

export const OPENSEARCH_CLIENT = Symbol('OPENSEARCH_CLIENT');

export const openSearchProvider: Provider = {
  provide: OPENSEARCH_CLIENT,
  inject: [searchConfig.KEY],
  useFactory: (config: ConfigType<typeof searchConfig>): Client =>
    new Client({
      node: config.node,
      auth: {
        username: config.username,
        password: config.password,
      },
      requestTimeout: 15_000,
    }),
};
