import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { UploadCompleteDto } from './dto/upload-complete.dto';
import { UploadQueryDto } from './dto/upload-query.dto';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'user')
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('sts')
  async getStsCredential(
    @Query() query: UploadQueryDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const credential = await this.uploadsService.createStsCredential({
      role: req.user.role,
      userId: req.user.sub,
      folder: query.folder,
    });
    await this.auditService.create({
      actorType:
        req.user.role === 'admin' ? AuditActorType.Admin : AuditActorType.User,
      actorId: req.user.sub,
      action: `${req.user.role}.upload.sts.issue`,
      targetType: 'upload-sts',
      metadata: {
        batchId: credential.batchId,
        dir: credential.dir,
        folder: query.folder ?? null,
      },
    });
    return credential;
  }

  @Get('limits')
  getUploadLimits() {
    return this.uploadsService.getLimits();
  }

  @HttpCode(HttpStatus.OK)
  @Post('complete')
  async completeDirectUpload(
    @Body() body: UploadCompleteDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const result = await this.uploadsService.completeDirectUpload({
      batchId: body.batchId,
      role: req.user.role,
      userId: req.user.sub,
      key: body.key,
    });
    await this.auditService.create({
      actorType:
        req.user.role === 'admin' ? AuditActorType.Admin : AuditActorType.User,
      actorId: req.user.sub,
      action: `${req.user.role}.upload.complete`,
      targetType: 'upload-file',
      metadata: {
        batchId: body.batchId,
        key: result.key,
        moderation: result.moderation,
      },
    });
    return { item: result };
  }
}
