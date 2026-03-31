import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BasePlaceCreateDto {
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

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  noticeMnMN: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  noticeZhCN: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  noticeEn: string;
}

export class BasePlaceUpdateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameZhCN?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameMnMN?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[A-Za-z][A-Za-z\s'().-]{0,119}$/)
  province?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  provinceMnMN?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  provinceZhCN?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[A-Za-z][A-Za-z\s'().-]{0,119}$/)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  cityMnMN?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  cityZhCN?: string;

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

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  introMnMN?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  introZhCN?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  introEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  guideMnMN?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  guideZhCN?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  guideEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  noticeMnMN?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  noticeZhCN?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  noticeEn?: string;
}
