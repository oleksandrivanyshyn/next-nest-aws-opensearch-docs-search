import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { awsConfig } from '../../config/aws.config';

const PRESIGNED_URL_TTL_SECONDS = 300;

export interface ObjectMetadata {
  contentLength: number;
  contentType: string | undefined;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;

  constructor(
    @Inject(awsConfig.KEY)
    private readonly config: ConfigType<typeof awsConfig>,
  ) {
    this.client = new S3Client({ region: config.region });
  }

  async createPresignedPutUrl(
    key: string,
    contentType: string,
    contentLength: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: PRESIGNED_URL_TTL_SECONDS,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
  }

  async head(key: string): Promise<ObjectMetadata> {
    const response = await this.client.send(
      new HeadObjectCommand({ Bucket: this.config.bucketName, Key: key }),
    );
    return {
      contentLength: response.ContentLength ?? 0,
      contentType: response.ContentType,
    };
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucketName, Key: key }),
    );
    if (!response.Body) {
      throw new Error(`S3 object ${key} has no body`);
    }
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucketName, Key: key }),
    );
    this.logger.log(`Deleted s3://${this.config.bucketName}/${key}`);
  }
}
