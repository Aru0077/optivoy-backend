import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateShoppingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameZhCN: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameMnMN: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameEn: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[A-Za-z][A-Za-z\s'().-]{0,119}$/)
  province: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  provinceMnMN: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  provinceZhCN: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[A-Za-z][A-Za-z\s'().-]{0,119}$/)
  city: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  cityMnMN: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  cityZhCN: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  introMnMN: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  introZhCN: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  introEn: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  guideMnMN: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  guideZhCN: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  guideEn: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  openingHours?: string;

  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(720)
  suggestedDurationMinutes: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  avgSpendMinCny?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  avgSpendMaxCny?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;
}
