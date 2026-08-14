import { Test } from '@nestjs/testing';
import { ParserService } from './parser.service';
import { ParsingModule } from './parsing.module';
import { UnsupportedFileTypeError } from './parsing.errors';
import type { FileParser } from './interfaces/file-parser.interface';

class StubParser implements FileParser {
  readonly extensions = ['.stub'];

  constructor(private readonly text: string) {}

  extract(): Promise<string> {
    return Promise.resolve(this.text);
  }
}

const normalize = (raw: string): Promise<string> =>
  new ParserService([new StubParser(raw)]).extract(
    Buffer.alloc(0),
    'uploads/a.stub',
  );

describe('ParsingModule', () => {
  it('resolves ParserService with both parsers registered', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ParsingModule],
    }).compile();

    expect(moduleRef.get(ParserService)).toBeInstanceOf(ParserService);
  });
});

describe('ParserService normalization', () => {
  it('collapses runs of spaces and tabs into a single space', async () => {
    await expect(normalize('revenue  \t  grew')).resolves.toBe('revenue grew');
  });

  it('converts CRLF to LF', async () => {
    await expect(normalize('first\r\nsecond')).resolves.toBe('first\nsecond');
  });

  it('collapses three or more newlines into a blank line', async () => {
    await expect(normalize('first\n\n\n\nsecond')).resolves.toBe(
      'first\n\nsecond',
    );
  });

  it('trims surrounding whitespace', async () => {
    await expect(normalize('  padded  ')).resolves.toBe('padded');
  });
});

describe('ParserService dispatch', () => {
  it('throws UnsupportedFileTypeError for an unregistered extension', async () => {
    const service = new ParserService([new StubParser('text')]);

    await expect(
      service.extract(Buffer.alloc(0), 'uploads/image.png'),
    ).rejects.toThrow(UnsupportedFileTypeError);
  });

  it('matches extensions case-insensitively', async () => {
    const service = new ParserService([new StubParser('hello')]);

    await expect(
      service.extract(Buffer.alloc(0), 'uploads/file.STUB'),
    ).resolves.toBe('hello');
  });
});
