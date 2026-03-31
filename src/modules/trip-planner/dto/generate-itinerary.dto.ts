import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  Max,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateItineraryDto {
  @IsString()
  @MaxLength(120)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @IsDateString()
  arrivalDateTime: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(120)
  arrivalBufferMinutes: number = 90;

  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  selectedPointIds: string[];

  @IsString()
  @IsIn(['light', 'standard', 'compact'])
  paceMode: 'light' | 'standard' | 'compact';

  @IsString()
  @IsIn(['single', 'multi'])
  hotelMode: 'single' | 'multi';

  @IsOptional()
  @IsString()
  @IsIn(['auto', 'off'])
  mealPolicy: 'auto' | 'off' = 'auto';

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  arrivalAirportCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  departureAirportCode?: string;
}
