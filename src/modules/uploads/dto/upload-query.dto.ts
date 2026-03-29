import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UploadQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9/_-]+$/)
  folder?: string;
}
