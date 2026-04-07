import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ImportHolidayCalendarItemDto {
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  date: string;

  @IsString()
  @IsIn(['weekday', 'weekend', 'holiday'])
  dayType: 'weekday' | 'weekend' | 'holiday';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class ImportHolidayCalendarDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  sourceYear: number;

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportHolidayCalendarItemDto)
  items: ImportHolidayCalendarItemDto[];
}
