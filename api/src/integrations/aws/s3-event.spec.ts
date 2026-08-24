import { decodeS3Key, isObjectCreated, isTestEvent } from './s3-event';

const objectCreatedRecord = {
  eventName: 'ObjectCreated:Put',
  s3: {
    bucket: { name: 'bucket' },
    object: { key: 'uploads/a.pdf', size: 10 },
  },
};

describe('isTestEvent', () => {
  it('recognises the notification S3 sends when the hook is attached', () => {
    expect(isTestEvent({ Event: 's3:TestEvent' })).toBe(true);
  });

  it('does not treat an unrecognised payload as a test event', () => {
    expect(isTestEvent({})).toBe(false);
  });

  it('does not treat a real object-created notification as a test event', () => {
    expect(isTestEvent({ Records: [objectCreatedRecord] })).toBe(false);
  });
});

describe('isObjectCreated', () => {
  it('recognises a payload with at least one record', () => {
    expect(isObjectCreated({ Records: [objectCreatedRecord] })).toBe(true);
  });

  it('rejects a payload with no Records array', () => {
    expect(isObjectCreated({})).toBe(false);
  });

  it('rejects a payload with an empty Records array', () => {
    expect(isObjectCreated({ Records: [] })).toBe(false);
  });

  it('rejects the s3:TestEvent shape, which carries no Records at all', () => {
    expect(isObjectCreated({ Event: 's3:TestEvent' })).toBe(false);
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
