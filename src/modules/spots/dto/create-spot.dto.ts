import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { BasePlaceCreateDto } from '../../../common/dto/base-place.dto';

export class CreateSpotDto extends BasePlaceCreateDto {
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
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;
}
