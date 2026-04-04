import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class PlanningTimeRangeDto {
  @IsString()
  @Matches(HHMM_PATTERN)
  start: string;

  @IsString()
  @Matches(HHMM_PATTERN)
  end: string;
}

export class OpeningHoursItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => PlanningTimeRangeDto)
  periods: PlanningTimeRangeDto[];
}

export class QueueProfileDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  weekdayMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  weekendMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  holidayMinutes?: number;
}

export class BestVisitWindowDto extends PlanningTimeRangeDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  tag?: string;
}
