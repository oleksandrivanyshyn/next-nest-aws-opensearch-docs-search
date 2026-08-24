export interface S3EventRecord {
  eventName: string;
  s3: {
    bucket: { name: string };
    object: { key: string; size: number };
  };
}

export interface S3EventNotification {
  Records?: S3EventRecord[];
  Event?: string;
}

export function isTestEvent(payload: S3EventNotification): boolean {
  return payload.Event === 's3:TestEvent';
}

export function isObjectCreated(
  payload: S3EventNotification,
): payload is S3EventNotification & { Records: S3EventRecord[] } {
  return Array.isArray(payload.Records) && payload.Records.length > 0;
}

export function decodeS3Key(key: string): string {
  return decodeURIComponent(key.replace(/\+/g, ' '));
}
