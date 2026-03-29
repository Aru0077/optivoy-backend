import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class UploadCompleteDto {
  @IsUUID()
  batchId: string;

  @IsString()
  @MaxLength(512)
  @Matches(/^(?!.*\.\.)[A-Za-z0-9/_\-.]+$/)
  @Matches(/\.(jpg|jpeg|png|webp|gif)$/i)
  key: string;
}
