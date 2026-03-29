import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { AdminSpotsController } from './admin-spots.controller';
import { Spot } from './entities/spot.entity';
import { SpotsController } from './spots.controller';
import { SpotsService } from './spots.service';

@Module({
  imports: [TypeOrmModule.forFeature([Spot]), AuditModule, UsersModule],
  controllers: [SpotsController, AdminSpotsController],
  providers: [SpotsService, RolesGuard],
  exports: [SpotsService],
})
export class SpotsModule {}
