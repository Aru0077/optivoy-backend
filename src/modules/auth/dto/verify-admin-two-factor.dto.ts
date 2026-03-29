import { IsString, Length, Matches } from 'class-validator';

export class VerifyAdminTwoFactorDto {
  @IsString()
  challengeToken: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;
}
