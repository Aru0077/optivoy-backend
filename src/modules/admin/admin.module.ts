import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Admin } from './entities/admin.entity';
import { AdminSeed } from './seeds/admin.seed';

@Module({
  imports: [TypeOrmModule.forFeature([Admin]), UsersModule, AuditModule],
  controllers: [AdminController],
  providers: [AdminService, AdminSeed, RolesGuard],
  exports: [AdminService],
})
export class AdminModule {}
