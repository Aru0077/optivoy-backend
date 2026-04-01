import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecomputeCityMatrixDto {
  @IsString()
  @MaxLength(120)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;
}
