import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const databaseSchema = z.object({
  url: z.string().min(1),
});

export const databaseConfig = registerAs('database', () =>
  databaseSchema.parse({
    url: process.env.DATABASE_URL,
  }),
);
