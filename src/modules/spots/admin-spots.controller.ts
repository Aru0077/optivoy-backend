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
import { CreateSpotDto } from './dto/create-spot.dto';
import { ListAdminSpotsQueryDto } from './dto/list-admin-spots-query.dto';
import { UpdateSpotDto } from './dto/update-spot.dto';
import { SpotsService } from './spots.service';

@ApiTags('admin/spots')
@Controller('admin/spots')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSpotsController {
  constructor(
    private readonly spotsService: SpotsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async createSpot(
    @Body() dto: CreateSpotDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const spot = await this.spotsService.createSpot(dto);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.spot.created',
      targetType: 'spot',
      targetId: spot.id,
      metadata: { name: spot.name, city: spot.city },
    });
    return spot;
  }

  @Patch(':spotId')
  async updateSpot(
    @Param('spotId') spotId: string,
    @Body() dto: UpdateSpotDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const spot = await this.spotsService.updateSpot(spotId, dto);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.spot.updated',
      targetType: 'spot',
      targetId: spot.id,
      metadata: {
        city: spot.city,
        isPublished: spot.isPublished,
      },
    });
    return spot;
  }

  @Get()
  listSpots(@Query() query: ListAdminSpotsQueryDto) {
    return this.spotsService.listAdminSpots(query);
  }

  @Get(':spotId')
  getSpotById(@Param('spotId') spotId: string) {
    return this.spotsService.getAdminSpotById(spotId);
  }

  @Delete(':spotId')
  async deleteSpot(
    @Param('spotId') spotId: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    await this.spotsService.deleteSpot(spotId);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.spot.deleted',
      targetType: 'spot',
      targetId: spotId,
    });
    return { success: true };
  }
}
