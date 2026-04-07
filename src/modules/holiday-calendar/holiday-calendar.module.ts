import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { HolidayCalendarDay } from './entities/holiday-calendar-day.entity';
import { AdminHolidayCalendarController } from './admin-holiday-calendar.controller';
import { HolidayCalendarService } from './holiday-calendar.service';

@Module({
  imports: [TypeOrmModule.forFeature([HolidayCalendarDay]), UsersModule],
  controllers: [AdminHolidayCalendarController],
  providers: [HolidayCalendarService, RolesGuard],
  exports: [HolidayCalendarService],
})
export class HolidayCalendarModule {}
