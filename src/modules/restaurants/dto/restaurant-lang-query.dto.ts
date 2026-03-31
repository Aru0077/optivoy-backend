import { IsIn, IsOptional } from 'class-validator';

export class RestaurantLangQueryDto {
  @IsOptional()
  @IsIn(['mn-MN', 'en-US', 'zh-CN'])
  lang: 'mn-MN' | 'en-US' | 'zh-CN' = 'mn-MN';
}
