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
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateSpotDto {
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

  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(720)
  suggestedDurationMinutes: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  reservationRequired?: boolean;

  @ValidateIf((o: CreateSpotDto) => o.reservationRequired === true)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
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
