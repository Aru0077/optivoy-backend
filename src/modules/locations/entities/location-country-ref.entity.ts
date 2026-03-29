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

@Entity('location_country_refs')
@Unique('UQ_location_country_refs_code', ['code'])
@Index('IDX_location_country_refs_continent', ['continent'])
export class LocationCountryRef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 2 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  nameI18n: LocationNameI18n | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  continent: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
