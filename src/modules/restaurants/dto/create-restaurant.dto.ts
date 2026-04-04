import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { BasePlaceCreateDto } from '../../../common/dto/base-place.dto';
import {
  MealTimeWindowDto,
  QueueProfileDto,
} from '../../../common/dto/planning-metadata.dto';
import { RestaurantMealSlot } from '../entities/restaurant.entity';

export class CreateRestaurantDto extends BasePlaceCreateDto {
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

  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(720)
  suggestedDurationMinutes: number;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(4)
  @IsIn(['breakfast', 'lunch', 'dinner', 'night_snack'], { each: true })
  mealSlots: RestaurantMealSlot[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => MealTimeWindowDto)
  mealTimeWindowsJson?: MealTimeWindowDto[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  cuisineTags?: string[];

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
  reservationRequired?: boolean;

  @ValidateIf((o: CreateRestaurantDto) => o.reservationRequired === true)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Matches(/^https?:\/\/\S+$/i)
  reservationUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => QueueProfileDto)
  queueProfileJson?: QueueProfileDto;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;
}
