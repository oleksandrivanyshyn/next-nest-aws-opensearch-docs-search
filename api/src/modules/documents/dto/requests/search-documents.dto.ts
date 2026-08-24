import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchDocumentsDto {
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  q!: string;
}
