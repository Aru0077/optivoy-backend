import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { LocationCity } from './location-city.entity';
import { LocationNameI18n } from './location-province.entity';

@Entity('location_airports')
@Unique('UQ_location_airports_code', ['airportCode'])
@Index('IDX_location_airports_city_id', ['cityId'])
export class LocationAirport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  cityId: string;

  @ManyToOne(() => LocationCity, (city) => city.airports, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cityId' })
  city: LocationCity;

  @Column({ length: 8 })
  airportCode: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  nameI18n: LocationNameI18n | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'int', nullable: true })
  arrivalBufferMinutes: number | null;

  @Column({ type: 'int', nullable: true })
  departureBufferMinutes: number | null;

  @Column({ type: 'double precision', nullable: true })
  arrivalAnchorLatitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  arrivalAnchorLongitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  departureAnchorLatitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  departureAnchorLongitude: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
