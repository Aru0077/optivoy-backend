import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ListHolidayCalendarDaysQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @IsIn(['weekday', 'weekend', 'holiday'])
  dayType?: 'weekday' | 'weekend' | 'holiday';

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 200;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
