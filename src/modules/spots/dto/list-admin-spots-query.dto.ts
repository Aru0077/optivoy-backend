import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  IsString,
} from 'class-validator';

export class ListAdminSpotsQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['attraction', 'theme_park', 'culture', 'other'])
  placeType?: 'attraction' | 'theme_park' | 'culture' | 'other';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isPublished?: boolean;

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
