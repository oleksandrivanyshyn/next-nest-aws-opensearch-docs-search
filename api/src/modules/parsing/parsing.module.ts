import { Module } from '@nestjs/common';
import { ParserService } from './parser.service';
import { DocxParser } from './parsers/docx.parser';
import { PdfParser } from './parsers/pdf.parser';
import { FILE_PARSERS } from './parsing.constants';
import type { FileParser } from './interfaces/file-parser.interface';

const PARSERS = [PdfParser, DocxParser];

@Module({
  providers: [
    ...PARSERS,
    {
      provide: FILE_PARSERS,
      useFactory: (...parsers: FileParser[]): FileParser[] => parsers,
      inject: PARSERS,
    },
    ParserService,
  ],
  exports: [ParserService],
})
export class ParsingModule {}
