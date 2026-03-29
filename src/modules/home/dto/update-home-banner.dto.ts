import { IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateHomeBannerDto {
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_protocol: true })
  imageUrl: string;
}
