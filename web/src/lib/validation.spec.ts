import {
  MAX_FILE_SIZE_BYTES,
  MIME_DOCX,
  MIME_PDF,
  isValidEmail,
  resolveContentType,
  validateFile,
} from './validation';

const fileOf = (name: string, size: number): File =>
  ({ name, size }) as File;

describe('resolveContentType', () => {
  it('maps the two supported extensions', () => {
    expect(resolveContentType('report.pdf')).toBe(MIME_PDF);
    expect(resolveContentType('report.docx')).toBe(MIME_DOCX);
  });

  it('ignores extension casing', () => {
    expect(resolveContentType('REPORT.PDF')).toBe(MIME_PDF);
  });

  it('uses the last extension of a double-barrelled name', () => {
    expect(resolveContentType('archive.pdf.exe')).toBeNull();
    expect(resolveContentType('archive.exe.pdf')).toBe(MIME_PDF);
  });

  it('returns null for a name with no extension', () => {
    expect(resolveContentType('report')).toBeNull();
  });
});

describe('validateFile', () => {
  it('accepts a normal pdf', () => {
    expect(validateFile(fileOf('report.pdf', 1024))).toBeNull();
  });

  it('rejects an unsupported type', () => {
    expect(validateFile(fileOf('notes.txt', 1024))).toContain('.pdf and .docx');
  });

  it('rejects a file over the 10 MB cap', () => {
    expect(validateFile(fileOf('big.pdf', MAX_FILE_SIZE_BYTES + 1))).toContain(
      'limit is 10 MB',
    );
  });

  it('accepts a file exactly at the cap', () => {
    expect(validateFile(fileOf('edge.pdf', MAX_FILE_SIZE_BYTES))).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(validateFile(fileOf('empty.pdf', 0))).toBe('File is empty');
  });
});

describe('isValidEmail', () => {
  it.each(['a@b.co', ' spaced@example.com '])('accepts %s', (value) => {
    expect(isValidEmail(value)).toBe(true);
  });

  it.each(['', 'no-at-sign', 'no@domain', 'two@@example.com'])(
    'rejects %s',
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );
});
