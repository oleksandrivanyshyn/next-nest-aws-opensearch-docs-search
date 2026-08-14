export const FILE_PARSERS = Symbol('FILE_PARSERS');

export interface FileParser {
  readonly extensions: readonly string[];
  extract(buffer: Buffer): Promise<string>;
}
