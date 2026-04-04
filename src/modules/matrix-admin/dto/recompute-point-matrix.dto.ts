import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class RecomputePointMatrixDto {
  @IsUUID()
  @IsString()
  pointId: string;

  @IsOptional()
  @IsArray()
  @IsIn(['transit', 'driving', 'walking'], { each: true })
  modes?: Array<'transit' | 'driving' | 'walking'>;
}
