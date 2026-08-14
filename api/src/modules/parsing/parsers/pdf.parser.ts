import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { TextExtractionError } from '../parsing.errors';
import type { FileParser } from '../interfaces/file-parser.interface';

@Injectable()
export class PdfParser implements FileParser {
  readonly extensions = ['.pdf'];

  async extract(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } catch (error) {
      throw new TextExtractionError('Failed to parse PDF', { cause: error });
    } finally {
      await parser.destroy();
    }
  }
}
