import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserStatus } from '../../users/entities/user.entity';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
