import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BasePlaceCreateDto } from '../../../common/dto/base-place.dto';

export class CreateShoppingDto extends BasePlaceCreateDto {
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
