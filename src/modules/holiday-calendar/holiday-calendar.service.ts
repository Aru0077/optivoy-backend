import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import type { PlanningDayType } from '../../common/utils/planning-metadata.util';
import { CreateHolidayCalendarDayDto } from './dto/create-holiday-calendar-day.dto';
import { ImportHolidayCalendarDto } from './dto/import-holiday-calendar.dto';
import { ListHolidayCalendarDaysQueryDto } from './dto/list-holiday-calendar-days-query.dto';
import { UpdateHolidayCalendarDayDto } from './dto/update-holiday-calendar-day.dto';
import { HolidayCalendarDay } from './entities/holiday-calendar-day.entity';

export interface HolidayCalendarDayView {
  id: string;
  date: string;
  dayType: PlanningDayType;
  sourceYear: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class HolidayCalendarService {
  constructor(
    @InjectRepository(HolidayCalendarDay)
    private readonly holidayCalendarRepository: Repository<HolidayCalendarDay>,
  ) {}

  async listDays(query: ListHolidayCalendarDaysQueryDto): Promise<{
    total: number;
    items: HolidayCalendarDayView[];
  }> {
    const qb = this.holidayCalendarRepository.createQueryBuilder('day');

    if (query.year) {
      qb.where('day."sourceYear" = :year', { year: query.year });
    }
    if (query.dayType) {
      qb.andWhere('day."dayType" = :dayType', { dayType: query.dayType });
    }
    if (query.dateFrom) {
      qb.andWhere('day.date >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('day.date <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.q?.trim()) {
      qb.andWhere('(day.date ILIKE :q OR day.remark ILIKE :q)', {
        q: `%${query.q.trim()}%`,
      });
    }

    const [items, total] = await qb
      .orderBy('day.date', 'ASC')
      .take(query.limit)
      .skip(query.offset)
      .getManyAndCount();

    return {
      total,
      items: items.map((item) => this.mapDay(item)),
    };
  }

  async createDay(
    dto: CreateHolidayCalendarDayDto,
  ): Promise<HolidayCalendarDayView> {
    try {
      const saved = await this.holidayCalendarRepository.save(
        this.holidayCalendarRepository.create({
          date: dto.date,
          dayType: dto.dayType,
          sourceYear: dto.sourceYear,
          remark: dto.remark?.trim() || null,
        }),
      );
      return this.mapDay(saved);
    } catch (error) {
      this.rethrowUniqueDateConflict(error, dto.date);
      throw error;
    }
  }

  async updateDay(
    id: string,
    dto: UpdateHolidayCalendarDayDto,
  ): Promise<HolidayCalendarDayView> {
    const found = await this.holidayCalendarRepository.findOne({ where: { id } });
    if (!found) {
      throw new NotFoundException({
        code: 'HOLIDAY_CALENDAR_DAY_NOT_FOUND',
        message: 'Holiday calendar day not found.',
      });
    }

    if (dto.date !== undefined) {
      found.date = dto.date;
    }
    if (dto.dayType !== undefined) {
      found.dayType = dto.dayType;
    }
    if (dto.sourceYear !== undefined) {
      found.sourceYear = dto.sourceYear;
    }
    if (dto.remark !== undefined) {
      found.remark = dto.remark?.trim() || null;
    }

    try {
      const saved = await this.holidayCalendarRepository.save(found);
      return this.mapDay(saved);
    } catch (error) {
      this.rethrowUniqueDateConflict(error, dto.date ?? found.date);
      throw error;
    }
  }

  async deleteDay(id: string): Promise<{ success: true }> {
    const found = await this.holidayCalendarRepository.findOne({ where: { id } });
    if (!found) {
      throw new NotFoundException({
        code: 'HOLIDAY_CALENDAR_DAY_NOT_FOUND',
        message: 'Holiday calendar day not found.',
      });
    }
    await this.holidayCalendarRepository.remove(found);
    return { success: true };
  }

  async importDays(dto: ImportHolidayCalendarDto): Promise<{
    sourceYear: number;
    total: number;
    created: number;
    updated: number;
  }> {
    if (dto.items.length === 0) {
      throw new BadRequestException({
        code: 'HOLIDAY_CALENDAR_IMPORT_EMPTY',
        message: 'Holiday calendar import items cannot be empty.',
      });
    }

    const uniqueByDate = new Map(dto.items.map((item) => [item.date, item] as const));
    const existing = await this.holidayCalendarRepository.find({
      where: { date: In(Array.from(uniqueByDate.keys())) },
    });
    const existingByDate = new Map(existing.map((item) => [item.date, item] as const));

    let created = 0;
    let updated = 0;
    for (const [dayDate, item] of uniqueByDate.entries()) {
      const found = existingByDate.get(dayDate);
      if (found) {
        found.dayType = item.dayType;
        found.sourceYear = dto.sourceYear;
        found.remark = item.remark?.trim() || null;
        await this.holidayCalendarRepository.save(found);
        updated += 1;
        continue;
      }

      await this.holidayCalendarRepository.save(
        this.holidayCalendarRepository.create({
          date: dayDate,
          dayType: item.dayType,
          sourceYear: dto.sourceYear,
          remark: item.remark?.trim() || null,
        }),
      );
      created += 1;
    }

    return {
      sourceYear: dto.sourceYear,
      total: uniqueByDate.size,
      created,
      updated,
    };
  }

  async resolvePlanningCalendar(
    startDate: string,
    spanDays: number,
  ): Promise<{
    calendarDays: Array<{ date: string; dayType: PlanningDayType }>;
    warnings: string[];
  }> {
    const dates = Array.from({ length: spanDays }, (_, index) =>
      this.addDaysToIsoDate(startDate, index),
    );
    const rows = await this.holidayCalendarRepository.find({
      where: { date: In(dates) },
    });
    const byDate = new Map(rows.map((item) => [item.date, item.dayType] as const));
    const warnings: string[] = [];
    const coveredYears = new Set(rows.map((item) => item.sourceYear));
    const requestedYears = Array.from(
      new Set(
        dates
          .map((dayDate) => Number.parseInt(dayDate.slice(0, 4), 10))
          .filter((year) => Number.isFinite(year)),
      ),
    ).sort((left, right) => left - right);

    for (const year of requestedYears) {
      if (!coveredYears.has(year)) {
        warnings.push(`missing_holiday_calendar_year:${year}`);
      }
    }

    return {
      calendarDays: dates.map((dayDate) => {
        const found = byDate.get(dayDate);
        if (found) {
          return { date: dayDate, dayType: found };
        }
        return {
          date: dayDate,
          dayType: this.resolveFallbackPlanningDayType(dayDate),
        };
      }),
      warnings,
    };
  }

  private mapDay(item: HolidayCalendarDay): HolidayCalendarDayView {
    return {
      id: item.id,
      date: item.date,
      dayType: item.dayType,
      sourceYear: item.sourceYear,
      remark: item.remark,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private addDaysToIsoDate(date: string, days: number): string {
    const seed = new Date(`${date}T12:00:00.000Z`);
    if (!Number.isFinite(seed.getTime())) {
      return date;
    }
    const next = new Date(seed.getTime() + days * 24 * 60 * 60 * 1000);
    return next.toISOString().slice(0, 10);
  }

  private resolveFallbackPlanningDayType(dateValue: string): PlanningDayType {
    const seed = new Date(`${dateValue}T12:00:00.000Z`);
    if (!Number.isFinite(seed.getTime())) {
      return 'weekday';
    }
    const weekday = seed.getUTCDay();
    return weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';
  }

  private rethrowUniqueDateConflict(error: unknown, date: string): void {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string; constraint?: string };
      if (driverError?.code === '23505') {
        throw new ConflictException({
          code: 'HOLIDAY_CALENDAR_DAY_DATE_CONFLICT',
          message: `Holiday calendar day already exists for date=${date}.`,
        });
      }
    }
  }
}
