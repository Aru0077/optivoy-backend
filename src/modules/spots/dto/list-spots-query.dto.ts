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

export type SpotLang = 'mn-MN' | 'en-US' | 'zh-CN';

export class ListSpotsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @IsIn(['attraction', 'theme_park', 'culture', 'other'])
  placeType?: 'attraction' | 'theme_park' | 'culture' | 'other';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsIn(['mn-MN', 'en-US', 'zh-CN'])
  lang: SpotLang = 'mn-MN';

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
