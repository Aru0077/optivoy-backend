import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { LocationCity } from './location-city.entity';

export interface LocationNameI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

@Entity('location_provinces')
@Unique('UQ_location_provinces_country_name', ['country', 'name'])
@Index('IDX_location_provinces_country_name', ['country', 'name'])
export class LocationProvince {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 2, default: 'CN' })
  country: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  nameI18n: LocationNameI18n | null;

  @OneToMany(() => LocationCity, (city) => city.province)
  cities: LocationCity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
