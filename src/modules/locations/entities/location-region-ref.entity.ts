import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { LocationNameI18n } from './location-province.entity';

@Entity('location_region_refs')
@Unique('UQ_location_region_refs_code', ['code'])
@Index('IDX_location_region_refs_country', ['isoCountry'])
export class LocationRegionRef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  localCode: string | null;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  nameI18n: LocationNameI18n | null;

  @Column({ type: 'varchar', length: 2 })
  isoCountry: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  continent: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
