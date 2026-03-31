import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalNumberTransformer } from '../../../common/database/decimal-number.transformer';

export interface HotelIntroI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface HotelGuideI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface HotelNoticeI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface HotelNameI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface HotelRegionI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

@Entity('hotels')
export class HotelPlace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  nameI18n: HotelNameI18n | null;

  @Column({ length: 2, default: 'CN' })
  country: string;

  @Column({ length: 120, default: '' })
  province: string;

  @Column({ type: 'jsonb', nullable: true })
  provinceI18n: HotelRegionI18n | null;

  @Column({ length: 120 })
  city: string;

  @Column({ type: 'jsonb', nullable: true })
  cityI18n: HotelRegionI18n | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'jsonb' })
  introI18n: HotelIntroI18n;

  @Column({ type: 'jsonb', nullable: true })
  guideI18n: HotelGuideI18n | null;

  @Column({ type: 'jsonb', nullable: true })
  noticeI18n: HotelNoticeI18n | null;

  @Column({ type: 'int', nullable: true })
  starLevel: number | null;

  @Column({ type: 'boolean', default: true })
  foreignerFriendly: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  checkInTime: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  checkOutTime: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bookingUrl: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  pricePerNightMinCny: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  pricePerNightMaxCny: number | null;

  @Column({ default: true })
  isPublished: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
