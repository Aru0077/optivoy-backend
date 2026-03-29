import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listNotifications(
    @Req() req: Request & { user: JwtPayload },
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.listUserNotifications(req.user.sub, query);
  }

  @Get('unread-count')
  unreadCount(@Req() req: Request & { user: JwtPayload }) {
    return this.notificationsService.getUnreadCount(req.user.sub);
  }

  @Patch(':notificationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsRead(
    @Req() req: Request & { user: JwtPayload },
    @Param('notificationId') notificationId: string,
  ): Promise<void> {
    await this.notificationsService.markAsRead(req.user.sub, notificationId);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@Req() req: Request & { user: JwtPayload }) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }
}
