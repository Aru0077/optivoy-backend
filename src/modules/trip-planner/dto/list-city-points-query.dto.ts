import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListCityPointsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @IsOptional()
  @IsIn(['mn-MN', 'en-US', 'zh-CN'])
  lang: 'mn-MN' | 'en-US' | 'zh-CN' = 'mn-MN';
}
