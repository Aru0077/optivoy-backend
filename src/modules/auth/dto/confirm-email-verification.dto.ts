import { Matches } from 'class-validator';

export class ConfirmEmailVerificationDto {
  @Matches(/^\d{6}$/)
  code: string;
}
