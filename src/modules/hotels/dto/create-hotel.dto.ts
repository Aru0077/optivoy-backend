import { OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { BasePlaceCreateDto } from '../../../common/dto/base-place.dto';

export class CreateHotelDto extends OmitType(BasePlaceCreateDto, [
  'introMnMN',
  'introZhCN',
  'introEn',
  'guideMnMN',
  'guideZhCN',
  'guideEn',
  'noticeMnMN',
  'noticeZhCN',
  'noticeEn',
] as const) {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  starLevel?: number;

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
    (o: CreateHotelDto) =>
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
