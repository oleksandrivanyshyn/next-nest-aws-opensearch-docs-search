import { IsEmail } from 'class-validator';

export class UserScopeDto {
  @IsEmail()
  email!: string;
}
