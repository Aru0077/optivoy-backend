import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { LocationAirport } from './location-airport.entity';
import { LocationNameI18n, LocationProvince } from './location-province.entity';

@Entity('location_cities')
@Unique('UQ_location_cities_province_id_name', ['provinceId', 'name'])
@Index('IDX_location_cities_province_id_name', ['provinceId', 'name'])
export class LocationCity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  provinceId: string;

  @ManyToOne(() => LocationProvince, (province) => province.cities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'provinceId' })
  province: LocationProvince;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  nameI18n: LocationNameI18n | null;

  @OneToMany(() => LocationAirport, (airport) => airport.city)
  airports: LocationAirport[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
