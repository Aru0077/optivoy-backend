import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalNumberTransformer } from '../../../common/database/decimal-number.transformer';

export interface ShoppingIntroI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface ShoppingGuideI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface ShoppingNoticeI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface ShoppingNameI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

export interface ShoppingRegionI18n {
  'zh-CN'?: string;
  'mn-MN'?: string;
  'en-US'?: string;
  [key: string]: string | undefined;
}

@Entity('shopping_places')
export class ShoppingPlace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  nameI18n: ShoppingNameI18n | null;

  @Column({ length: 2, default: 'CN' })
  country: string;

  @Column({ length: 120, default: '' })
  province: string;

  @Column({ type: 'jsonb', nullable: true })
  provinceI18n: ShoppingRegionI18n | null;

  @Column({ length: 120 })
  city: string;

  @Column({ type: 'jsonb', nullable: true })
  cityI18n: ShoppingRegionI18n | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'jsonb' })
  introI18n: ShoppingIntroI18n;

  @Column({ type: 'jsonb', nullable: true })
  guideI18n: ShoppingGuideI18n | null;

  @Column({ type: 'jsonb', nullable: true })
  noticeI18n: ShoppingNoticeI18n | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  openingHours: string | null;

  @Column({ type: 'int', default: 240 })
  suggestedDurationMinutes: number;

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
