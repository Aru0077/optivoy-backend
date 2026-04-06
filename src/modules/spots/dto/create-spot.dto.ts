import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { BasePlaceCreateDto } from '../../../common/dto/base-place.dto';
import {
  OpeningHoursItemDto,
  QueueProfileDto,
} from '../../../common/dto/planning-metadata.dto';

export class CreateSpotDto extends BasePlaceCreateDto {
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  entryLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  entryLongitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  exitLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  exitLongitude?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OpeningHoursItemDto)
  openingHoursJson?: OpeningHoursItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(366)
  @IsString({ each: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  specialClosureDates?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  lastEntryTime?: string;

  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(720)
  suggestedDurationMinutes: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(3)
  staminaFactor?: number;

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
  @ValidateNested()
  @Type(() => QueueProfileDto)
  queueProfileJson?: QueueProfileDto;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasFoodCourt?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;
}
