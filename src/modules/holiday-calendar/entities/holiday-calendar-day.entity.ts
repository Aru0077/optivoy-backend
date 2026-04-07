import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { PlanningDayType } from '../../../common/utils/planning-metadata.util';

@Entity('holiday_calendar_days')
@Unique('UQ_holiday_calendar_days_date', ['date'])
@Index('IDX_holiday_calendar_days_source_year', ['sourceYear'])
export class HolidayCalendarDay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 16 })
  dayType: PlanningDayType;

  @Column({ type: 'int' })
  sourceYear: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
