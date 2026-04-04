import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsInt,
  IsNumber,
  IsOptional,
  IsArray,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { BasePlaceCreateDto } from '../../../common/dto/base-place.dto';
import { OpeningHoursItemDto } from '../../../common/dto/planning-metadata.dto';

export class CreateShoppingDto extends BasePlaceCreateDto {
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  arrivalAnchorLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  arrivalAnchorLongitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  departureAnchorLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  departureAnchorLongitude?: number;

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
  hasFoodCourt?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;
}
