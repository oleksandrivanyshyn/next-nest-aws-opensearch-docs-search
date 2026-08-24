import {
  IsEmail,
  IsIn,
  IsInt,
  IsString,
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
  filename!: string;

  @IsIn(ALLOWED_MIME_TYPES)
  contentType!: AllowedMimeType;

  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE_BYTES - 1)
  size!: number;
}
