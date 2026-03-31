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
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { ListAdminRestaurantQueryDto } from './dto/list-admin-restaurant-query.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { RestaurantService } from './restaurant.service';

@ApiTags('admin/restaurants')
@Controller('admin/restaurants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminRestaurantController {
  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async createRestaurant(
    @Body() dto: CreateRestaurantDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const item = await this.restaurantService.createRestaurant(dto);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.restaurant.created',
      targetType: 'restaurant',
      targetId: item.id,
      metadata: { name: item.name, city: item.city },
    });
    return item;
  }

  @Patch(':restaurantId')
  async updateRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: UpdateRestaurantDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const item = await this.restaurantService.updateRestaurant(restaurantId, dto);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.restaurant.updated',
      targetType: 'restaurant',
      targetId: item.id,
      metadata: { city: item.city, isPublished: item.isPublished },
    });
    return item;
  }

  @Get()
  listRestaurant(@Query() query: ListAdminRestaurantQueryDto) {
    return this.restaurantService.listAdminRestaurant(query);
  }

  @Get(':restaurantId')
  getRestaurantById(@Param('restaurantId') restaurantId: string) {
    return this.restaurantService.getAdminRestaurantById(restaurantId);
  }

  @Delete(':restaurantId')
  async deleteRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    await this.restaurantService.deleteRestaurant(restaurantId);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.restaurant.deleted',
      targetType: 'restaurant',
      targetId: restaurantId,
    });
    return { success: true };
  }
}
