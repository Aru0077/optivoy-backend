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
  ValidateIf,
} from 'class-validator';

export class CreateHotelDto {
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  starLevel?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  foreignerFriendly?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  checkInTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  checkOutTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf(
    (o: CreateHotelDto) =>
      typeof o.bookingUrl === 'string' && o.bookingUrl.trim().length > 0,
  )
  @Matches(/^https?:\/\/\S+$/i)
  bookingUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pricePerNightMinCny?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pricePerNightMaxCny?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;
}
