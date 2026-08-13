import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SearchDocumentsDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  q!: string;
}
