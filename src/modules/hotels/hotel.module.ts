import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { TripPlannerModule } from '../trip-planner/trip-planner.module';
import { TransitCacheModule } from '../transit-cache/transit-cache.module';
import { AdminHotelController } from './admin-hotel.controller';
import { HotelController } from './hotel.controller';
import { HotelPlace } from './entities/hotel.entity';
import { HotelService } from './hotel.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HotelPlace]),
    AuditModule,
    UsersModule,
    TripPlannerModule,
    TransitCacheModule,
  ],
  controllers: [HotelController, AdminHotelController],
  providers: [HotelService, RolesGuard],
  exports: [HotelService],
})
export class HotelModule {}
