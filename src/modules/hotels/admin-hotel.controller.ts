import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { ListAdminHotelQueryDto } from './dto/list-admin-hotel-query.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { HotelService } from './hotel.service';

@ApiTags('admin/hotels')
@Controller('admin/hotels')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminHotelController {
  constructor(
    private readonly hotelService: HotelService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async createHotel(
    @Body() dto: CreateHotelDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const item = await this.hotelService.createHotel(dto);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.hotel.created',
      targetType: 'hotel',
      targetId: item.id,
      metadata: { name: item.name, city: item.city },
    });
    return item;
  }

  @Patch(':hotelId')
  async updateHotel(
    @Param('hotelId') hotelId: string,
    @Body() dto: UpdateHotelDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const item = await this.hotelService.updateHotel(hotelId, dto);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.hotel.updated',
      targetType: 'hotel',
      targetId: item.id,
      metadata: { city: item.city, isPublished: item.isPublished },
    });
    return item;
  }

  @Get()
  listHotel(@Query() query: ListAdminHotelQueryDto) {
    return this.hotelService.listAdminHotel(query);
  }

  @Get(':hotelId')
  getHotelById(@Param('hotelId') hotelId: string) {
    return this.hotelService.getAdminHotelById(hotelId);
  }

  @Delete(':hotelId')
  async deleteHotel(
    @Param('hotelId') hotelId: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    await this.hotelService.deleteHotel(hotelId);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.hotel.deleted',
      targetType: 'hotel',
      targetId: hotelId,
    });
    return { success: true };
  }
}
