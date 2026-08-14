import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { TextExtractionError } from '../parsing.errors';
import type { FileParser } from '../interfaces/file-parser.interface';

@Injectable()
export class DocxParser implements FileParser {
  readonly extensions = ['.docx'];

  async extract(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new TextExtractionError('Failed to parse DOCX', { cause: error });
    }
  }
}
