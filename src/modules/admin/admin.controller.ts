import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from '../users/users.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers({
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Patch('users/:userId/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request & { user: JwtPayload },
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    await this.usersService.updateUserStatus(
      userId,
      dto.status,
      dto.reason ?? null,
    );

    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.user.status.updated',
      targetType: 'user',
      targetId: userId,
      metadata: {
        status: dto.status,
        reason: dto.reason ?? null,
      },
    });
  }

  @Post('users/:userId/force-logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forceLogoutUser(
    @Param('userId') userId: string,
    @Req() req: Request & { user: JwtPayload },
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    await this.usersService.clearAllRefreshTokens(userId);

    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.user.force_logout',
      targetType: 'user',
      targetId: userId,
    });
  }

  @Get('audit-logs')
  listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.findMany(query);
  }
}
