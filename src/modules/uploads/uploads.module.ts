import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { UploadBatchItem } from './entities/upload-batch-item.entity';
import { UploadBatch } from './entities/upload-batch.entity';
import { UploadBatchCleanupService } from './upload-batch-cleanup.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [
    AuditModule,
    UsersModule,
    TypeOrmModule.forFeature([UploadBatch, UploadBatchItem]),
  ],
  controllers: [UploadsController],
  providers: [UploadsService, UploadBatchCleanupService, RolesGuard],
  exports: [UploadsService],
})
export class UploadsModule {}
