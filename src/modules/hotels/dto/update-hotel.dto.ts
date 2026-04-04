import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { BasePlaceUpdateDto } from '../../../common/dto/base-place.dto';

export class UpdateHotelDto extends BasePlaceUpdateDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  starLevel?: number;

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

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  checkInTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  checkOutTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf(
    (o: UpdateHotelDto) =>
      typeof o.bookingUrl === 'string' && o.bookingUrl.trim().length > 0,
  )
  @Matches(/^https?:\/\/\S+$/i)
  bookingUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pricePerNightMinCny?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pricePerNightMaxCny?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;
}
