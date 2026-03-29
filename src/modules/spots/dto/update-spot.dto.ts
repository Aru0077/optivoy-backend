import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsLatitude,
  IsLongitude,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateSpotDto {
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
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(720)
  suggestedDurationMinutes?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  reservationRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf(
    (o: UpdateSpotDto) =>
      typeof o.reservationUrl === 'string' &&
      o.reservationUrl.trim().length > 0,
  )
  @Matches(/^https?:\/\/\S+$/i)
  reservationUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reservationNoteMnMN?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reservationNoteZhCN?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reservationNoteEn?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  closedWeekdays?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  ticketPriceMinCny?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  ticketPriceMaxCny?: number;

  @IsOptional()
  @IsString()
  @IsIn(['attraction', 'theme_park', 'culture', 'other'])
  placeType?: 'attraction' | 'theme_park' | 'culture' | 'other';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;
}
