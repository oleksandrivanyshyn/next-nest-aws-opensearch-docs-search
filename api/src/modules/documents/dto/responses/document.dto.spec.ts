import { DocumentResponseDto } from './document.dto';
import type { DocumentRow } from '../../../../core/db/drizzle/types';

const buildRow = (overrides: Partial<DocumentRow> = {}): DocumentRow => ({
  id: '11111111-1111-4111-8111-111111111111',
  userEmail: 'owner@example.com',
  userFilename: 'report.pdf',
  s3Key: 'uploads/11111111-1111-4111-8111-111111111111.pdf',
  status: 'PENDING',
  errorMessage: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...overrides,
});

describe('DocumentResponseDto', () => {
  it('serializes timestamps as ISO strings', () => {
    const dto = DocumentResponseDto.fromRow(buildRow());

    expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(dto.updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('never exposes the s3 key or the owner email', () => {
    const dto = DocumentResponseDto.fromRow(buildRow());

    expect(Object.keys(dto).sort()).toEqual([
      'createdAt',
      'errorMessage',
      'id',
      'status',
      'updatedAt',
      'userFilename',
    ]);
  });
});
