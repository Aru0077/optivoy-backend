import { IsString, MinLength } from 'class-validator';

export class LinkOauthDto {
  @IsString()
  @MinLength(1)
  linkToken: string;
}
