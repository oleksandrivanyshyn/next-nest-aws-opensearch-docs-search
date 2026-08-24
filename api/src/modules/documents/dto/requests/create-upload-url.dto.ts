import {
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../../documents.constants';
import type { AllowedMimeType } from '../../documents.constants';

export class CreateUploadUrlDto {
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;

  @IsString()
  @MaxLength(255)
  @Matches(/\.(pdf|docx)$/i, { message: 'filename must end in .pdf or .docx' })
  filename!: string;

  @IsIn(ALLOWED_MIME_TYPES)
  contentType!: AllowedMimeType;

  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE_BYTES - 1)
  size!: number;
}
