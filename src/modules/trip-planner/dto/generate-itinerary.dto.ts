import {
  IsDateString,
  IsIn,
  IsOptional,
  IsArray,
  IsString,
  IsUUID,
  ArrayMaxSize,
  ArrayUnique,
  MaxLength,
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
  startDate: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  selectedPointIds: string[];

  @IsString()
  @IsIn(['light', 'standard', 'compact'])
  paceMode: 'light' | 'standard' | 'compact';

  @IsString()
  @IsIn(['single', 'smart'])
  hotelStrategy: 'single' | 'smart';
}
