import { IsString, IsUUID } from 'class-validator';

export class RecomputePointMatrixDto {
  @IsUUID()
  @IsString()
  pointId: string;
}
