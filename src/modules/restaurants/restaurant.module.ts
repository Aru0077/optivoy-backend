import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TripPlannerModule } from '../trip-planner/trip-planner.module';
import { TransitCacheModule } from '../transit-cache/transit-cache.module';
import { UsersModule } from '../users/users.module';
import { AdminRestaurantController } from './admin-restaurant.controller';
import { RestaurantPlace } from './entities/restaurant.entity';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RestaurantPlace]),
    AuditModule,
    UsersModule,
    TripPlannerModule,
    TransitCacheModule,
  ],
  controllers: [RestaurantController, AdminRestaurantController],
  providers: [RestaurantService, RolesGuard],
  exports: [RestaurantService],
})
export class RestaurantModule {}
