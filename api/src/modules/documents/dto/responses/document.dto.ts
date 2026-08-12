import type {
  DocumentRow,
  DocumentStatus,
} from '../../../../core/db/drizzle/types';

export class DocumentResponseDto {
  id!: string;
  userFilename!: string;
  status!: DocumentStatus;
  errorMessage!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static fromRow(row: DocumentRow): DocumentResponseDto {
    const dto = new DocumentResponseDto();
    dto.id = row.id;
    dto.userFilename = row.userFilename;
    dto.status = row.status;
    dto.errorMessage = row.errorMessage;
    dto.createdAt = row.createdAt.toISOString();
    dto.updatedAt = row.updatedAt.toISOString();
    return dto;
  }

  static fromRows(rows: DocumentRow[]): DocumentResponseDto[] {
    return rows.map((row) => this.fromRow(row));
  }
}
