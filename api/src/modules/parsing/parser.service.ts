import { Inject, Injectable, Logger } from '@nestjs/common';
import { extname } from 'node:path';
import { FILE_PARSERS } from './parsing.constants';
import { UnsupportedFileTypeError } from './parsing.errors';
import type { FileParser } from './interfaces/file-parser.interface';

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);
  private readonly parsers = new Map<string, FileParser>();

  constructor(@Inject(FILE_PARSERS) parsers: FileParser[]) {
    for (const parser of parsers) {
      for (const extension of parser.extensions) {
        this.parsers.set(extension.toLowerCase(), parser);
      }
    }
  }

  async extract(buffer: Buffer, key: string): Promise<string> {
    const extension = extname(key).toLowerCase();
    const parser = this.parsers.get(extension);

    if (!parser) {
      throw new UnsupportedFileTypeError(extension);
    }

    const text = await parser.extract(buffer);
    const normalized = this.normalize(text);

    this.logger.log(`Extracted ${normalized.length} chars from ${key}`);
    return normalized;
  }

  private normalize(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
