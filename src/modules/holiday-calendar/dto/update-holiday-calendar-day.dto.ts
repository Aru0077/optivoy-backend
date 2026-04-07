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

export class UpdateHolidayCalendarDayDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  date?: string;

  @IsOptional()
  @IsString()
  @IsIn(['weekday', 'weekend', 'holiday'])
  dayType?: 'weekday' | 'weekend' | 'holiday';

  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2100)
  sourceYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
