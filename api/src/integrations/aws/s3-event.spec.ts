import { decodeS3Key, isTestEvent } from './s3-event';

describe('isTestEvent', () => {
  it('recognises the notification S3 sends when the hook is attached', () => {
    expect(isTestEvent({ Event: 's3:TestEvent' })).toBe(true);
  });

  it('treats a payload without a Records array as a test event', () => {
    expect(isTestEvent({})).toBe(true);
  });

  it('lets a real object-created notification through', () => {
    expect(
      isTestEvent({
        Records: [
          {
            eventName: 'ObjectCreated:Put',
            s3: {
              bucket: { name: 'bucket' },
              object: { key: 'uploads/a.pdf', size: 10 },
            },
          },
        ],
      }),
    ).toBe(false);
  });
});

describe('decodeS3Key', () => {
  it('decodes the plus sign S3 uses for spaces', () => {
    expect(decodeS3Key('uploads/my+report.pdf')).toBe('uploads/my report.pdf');
  });

  it('decodes percent-encoded characters', () => {
    expect(decodeS3Key('uploads/%D0%B7%D0%B2%D1%96%D1%82.pdf')).toBe(
      'uploads/звіт.pdf',
    );
  });

  it('leaves a plain uuid key untouched', () => {
    const key = 'uploads/11111111-1111-4111-8111-111111111111.pdf';

    expect(decodeS3Key(key)).toBe(key);
  });
});
