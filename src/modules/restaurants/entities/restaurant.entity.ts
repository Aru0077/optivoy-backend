import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalNumberTransformer } from '../../../common/database/decimal-number.transformer';

export type RestaurantMealSlot =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'night_snack';

export interface RestaurantIntroI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface RestaurantGuideI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface RestaurantNoticeI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface RestaurantNameI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface RestaurantRegionI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

@Entity('restaurants')
export class RestaurantPlace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  nameI18n: RestaurantNameI18n | null;

  @Column({ length: 2, default: 'CN' })
  country: string;

  @Column({ length: 120, default: '' })
  province: string;

  @Column({ type: 'jsonb', nullable: true })
  provinceI18n: RestaurantRegionI18n | null;

  @Column({ length: 120 })
  city: string;

  @Column({ type: 'jsonb', nullable: true })
  cityI18n: RestaurantRegionI18n | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'jsonb' })
  introI18n: RestaurantIntroI18n;

  @Column({ type: 'jsonb', nullable: true })
  guideI18n: RestaurantGuideI18n | null;

  @Column({ type: 'jsonb', nullable: true })
  noticeI18n: RestaurantNoticeI18n | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  openingHours: string | null;

  @Column({ type: 'jsonb', nullable: true })
  closedWeekdays: number[] | null;

  @Column({ type: 'int', default: 90 })
  suggestedDurationMinutes: number;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  mealSlots: RestaurantMealSlot[];

  @Column({ type: 'jsonb', nullable: true })
  cuisineTags: string[] | null;

  @Column({ type: 'boolean', default: false })
  reservationRequired: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reservationUrl: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  avgSpendMinCny: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  avgSpendMaxCny: number | null;

  @Column({ default: true })
  isPublished: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
