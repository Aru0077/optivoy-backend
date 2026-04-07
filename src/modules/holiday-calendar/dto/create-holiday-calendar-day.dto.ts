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

export class CreateHolidayCalendarDayDto {
  @IsString()
  @Matches(ISO_DATE_PATTERN)
  date: string;

  @IsString()
  @IsIn(['weekday', 'weekend', 'holiday'])
  dayType: 'weekday' | 'weekend' | 'holiday';

  @IsInt()
  @Min(2020)
  @Max(2100)
  sourceYear: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
