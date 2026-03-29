import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
