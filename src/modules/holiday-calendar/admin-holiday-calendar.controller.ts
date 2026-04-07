import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateHolidayCalendarDayDto } from './dto/create-holiday-calendar-day.dto';
import { ImportHolidayCalendarDto } from './dto/import-holiday-calendar.dto';
import { ListHolidayCalendarDaysQueryDto } from './dto/list-holiday-calendar-days-query.dto';
import { UpdateHolidayCalendarDayDto } from './dto/update-holiday-calendar-day.dto';
import { HolidayCalendarService } from './holiday-calendar.service';

@ApiTags('admin/holiday-calendar')
@Controller('admin/holiday-calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminHolidayCalendarController {
  constructor(
    private readonly holidayCalendarService: HolidayCalendarService,
  ) {}

  @Get('days')
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  listDays(@Query() query: ListHolidayCalendarDaysQueryDto) {
    return this.holidayCalendarService.listDays(query);
  }

  @Post('days')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  createDay(@Body() dto: CreateHolidayCalendarDayDto) {
    return this.holidayCalendarService.createDay(dto);
  }

  @Patch('days/:id')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  updateDay(@Param('id') id: string, @Body() dto: UpdateHolidayCalendarDayDto) {
    return this.holidayCalendarService.updateDay(id, dto);
  }

  @Delete('days/:id')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  deleteDay(@Param('id') id: string) {
    return this.holidayCalendarService.deleteDay(id);
  }

  @Post('import')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  importDays(@Body() dto: ImportHolidayCalendarDto) {
    return this.holidayCalendarService.importDays(dto);
  }
}
