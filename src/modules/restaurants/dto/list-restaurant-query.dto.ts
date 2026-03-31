import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type RestaurantLang = 'mn-MN' | 'en-US' | 'zh-CN';

export class ListRestaurantQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsIn(['mn-MN', 'en-US', 'zh-CN'])
  lang: RestaurantLang = 'mn-MN';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
