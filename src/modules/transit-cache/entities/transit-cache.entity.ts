import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type TransitCachePointType =
  | 'spot'
  | 'shopping'
  | 'restaurant'
  | 'hotel'
  | 'airport';

export type TransitCacheStatus = 'ready' | 'stale' | 'failed';

@Entity('transit_cache')
@Unique('UQ_transit_cache_city_from_to', ['city', 'fromPointId', 'toPointId'])
@Index('IDX_transit_cache_city', ['city'])
@Index('IDX_transit_cache_from', ['fromPointId'])
@Index('IDX_transit_cache_to', ['toPointId'])
@Index('IDX_transit_cache_updated_at', ['updatedAt'])
@Check('CHK_transit_cache_from_to_not_equal', '"fromPointId" <> "toPointId"')
export class TransitCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  city: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  province: string | null;

  @Column('uuid')
  fromPointId: string;

  @Column({ length: 16 })
  fromPointType: TransitCachePointType;

  @Column('uuid')
  toPointId: string;

  @Column({ length: 16 })
  toPointType: TransitCachePointType;

  @Column({ type: 'int' })
  transitMinutes: number;

  @Column({ type: 'int' })
  drivingMinutes: number;

  @Column({ type: 'int' })
  walkingMeters: number;

  @Column({ type: 'text', nullable: true })
  transitSummary: string | null;

  @Column({ type: 'jsonb', nullable: true })
  transitSummaryI18n: Record<string, string> | null;

  @Column({ type: 'double precision' })
  distanceKm: number;

  @Column({ type: 'varchar', length: 24, default: 'amap' })
  provider: string;

  @Column({ type: 'varchar', length: 16, default: 'ready' })
  status: TransitCacheStatus;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
