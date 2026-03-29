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
import { CreateShoppingDto } from './dto/create-shopping.dto';
import { ListAdminShoppingQueryDto } from './dto/list-admin-shopping-query.dto';
import { UpdateShoppingDto } from './dto/update-shopping.dto';
import { ShoppingService } from './shopping.service';

@ApiTags('admin/shopping')
@Controller('admin/shopping')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminShoppingController {
  constructor(
    private readonly shoppingService: ShoppingService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async createShopping(
    @Body() dto: CreateShoppingDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const item = await this.shoppingService.createShopping(dto);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.shopping.created',
      targetType: 'shopping',
      targetId: item.id,
      metadata: { name: item.name, city: item.city },
    });
    return item;
  }

  @Patch(':shoppingId')
  async updateShopping(
    @Param('shoppingId') shoppingId: string,
    @Body() dto: UpdateShoppingDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const item = await this.shoppingService.updateShopping(shoppingId, dto);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.shopping.updated',
      targetType: 'shopping',
      targetId: item.id,
      metadata: { city: item.city, isPublished: item.isPublished },
    });
    return item;
  }

  @Get()
  listShopping(@Query() query: ListAdminShoppingQueryDto) {
    return this.shoppingService.listAdminShopping(query);
  }

  @Get(':shoppingId')
  getShoppingById(@Param('shoppingId') shoppingId: string) {
    return this.shoppingService.getAdminShoppingById(shoppingId);
  }

  @Delete(':shoppingId')
  async deleteShopping(
    @Param('shoppingId') shoppingId: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    await this.shoppingService.deleteShopping(shoppingId);
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.shopping.deleted',
      targetType: 'shopping',
      targetId: shoppingId,
    });
    return { success: true };
  }
}
