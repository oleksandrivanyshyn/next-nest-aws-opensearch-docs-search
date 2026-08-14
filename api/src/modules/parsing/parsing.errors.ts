export class UnsupportedFileTypeError extends Error {
  constructor(extension: string) {
    super(`Unsupported file type: ${extension}`);
    this.name = 'UnsupportedFileTypeError';
  }
}

export class TextExtractionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TextExtractionError';
  }
}
