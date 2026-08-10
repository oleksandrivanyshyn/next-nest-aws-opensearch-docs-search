import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const searchSchema = z.object({
  node: z.url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const searchConfig = registerAs('search', () =>
  searchSchema.parse({
    node: process.env.OPENSEARCH_NODE,
    username: process.env.OPENSEARCH_AUTH_USERNAME,
    password: process.env.OPENSEARCH_AUTH_PASSWORD,
  }),
);
