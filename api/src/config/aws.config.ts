import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const awsSchema = z.object({
  region: z.string().min(1),
  bucketName: z.string().min(1),
  queueUrl: z.url(),
});

export const awsConfig = registerAs('aws', () =>
  awsSchema.parse({
    region: process.env.AWS_REGION,
    bucketName: process.env.AWS_S3_BUCKET_NAME,
    queueUrl: process.env.AWS_SQS_QUEUE_URL,
  }),
);
