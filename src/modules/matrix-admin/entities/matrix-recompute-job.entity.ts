import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransitCachePointType } from '../../transit-cache/entities/transit-cache.entity';

export type MatrixRecomputeScope = 'city' | 'point';
export type MatrixRecomputeMode = 'transit' | 'driving' | 'walking';
export type MatrixRecomputeJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'rate_limited';

@Entity('matrix_recompute_jobs')
@Index('IDX_matrix_recompute_jobs_status_created', ['status', 'createdAt'])
@Index('IDX_matrix_recompute_jobs_city_province_created', [
  'city',
  'province',
  'createdAt',
])
export class MatrixRecomputeJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  scope: MatrixRecomputeScope;

  @Column({ type: 'varchar', length: 120 })
  city: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  province: string | null;

  @Column({ type: 'uuid', nullable: true })
  pointId: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  pointType: TransitCachePointType | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  modes: MatrixRecomputeMode[];

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: MatrixRecomputeJobStatus;

  @Column({ type: 'int', default: 0 })
  totalEdges: number;

  @Column({ type: 'int', default: 0 })
  processedEdges: number;

  @Column({ type: 'int', default: 0 })
  transitReadyEdges: number;

  @Column({ type: 'int', default: 0 })
  transitFallbackEdges: number;

  @Column({ type: 'int', default: 0 })
  transitNoRouteEdges: number;

  @Column({ type: 'int', default: 0 })
  drivingReadyEdges: number;

  @Column({ type: 'int', default: 0 })
  walkingReadyEdges: number;

  @Column({ type: 'int', default: 0 })
  walkingMinutesReadyEdges: number;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
