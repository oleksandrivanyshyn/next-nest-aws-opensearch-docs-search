import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class UserScopeDto {
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;
}
