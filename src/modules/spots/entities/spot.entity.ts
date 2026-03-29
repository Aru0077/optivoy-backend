import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface SpotIntroI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface SpotGuideI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface SpotReservationNoteI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface SpotNameI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface SpotRegionI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export type SpotPlaceType = 'attraction' | 'theme_park' | 'culture' | 'other';

@Entity('spots')
export class Spot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  nameI18n: SpotNameI18n | null;

  @Column({ length: 2, default: 'CN' })
  country: string;

  @Column({ length: 120, default: '' })
  province: string;

  @Column({ type: 'jsonb', nullable: true })
  provinceI18n: SpotRegionI18n | null;

  @Column({ length: 120 })
  city: string;

  @Column({ type: 'jsonb', nullable: true })
  cityI18n: SpotRegionI18n | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'jsonb' })
  introI18n: SpotIntroI18n;

  @Column({ type: 'jsonb', nullable: true })
  guideI18n: SpotGuideI18n | null;

  @Column({ type: 'int', default: 240 })
  suggestedDurationMinutes: number;

  @Column({ type: 'boolean', default: false })
  reservationRequired: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reservationUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  reservationNoteI18n: SpotReservationNoteI18n | null;

  @Column({ type: 'jsonb', nullable: true })
  closedWeekdays: number[] | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  ticketPriceMinCny: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  ticketPriceMaxCny: string | null;

  @Column({ type: 'varchar', length: 32, default: 'attraction' })
  placeType: SpotPlaceType;

  @Column({ default: true })
  isPublished: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
