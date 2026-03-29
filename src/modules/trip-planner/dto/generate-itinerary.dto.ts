import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  tripDays: number;

  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  selectedSpotIds: string[];

  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  selectedShoppingIds: string[];

  @IsOptional()
  @IsDateString()
  preferredReturnDepartureDateTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  regenerateInstruction?: string;
}
