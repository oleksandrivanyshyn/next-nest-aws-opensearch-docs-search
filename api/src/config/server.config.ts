import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const serverSchema = z.object({
  port: z.coerce.number().int().positive().default(5000),
  corsOrigins: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
});

export const serverConfig = registerAs('server', () =>
  serverSchema.parse({
    port: process.env.PORT,
    corsOrigins: process.env.CORS_ORIGINS,
  }),
);
