import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HolidayCalendarModule } from '../holiday-calendar/holiday-calendar.module';
import { HotelPlace } from '../hotels/entities/hotel.entity';
import { LocationAirport } from '../locations/entities/location-airport.entity';
import { ShoppingPlace } from '../shopping/entities/shopping.entity';
import { Spot } from '../spots/entities/spot.entity';
import { TransitCacheModule } from '../transit-cache/transit-cache.module';
import { UsersModule } from '../users/users.module';
import { AdminTripPlannerController } from './admin-trip-planner.controller';
import { OptimizerClient } from './optimizer.client';
import { TripPlannerCacheService } from './trip-planner-cache.service';
import { TripPlannerController } from './trip-planner.controller';
import { TripPlannerService } from './trip-planner.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Spot,
      ShoppingPlace,
      HotelPlace,
      LocationAirport,
    ]),
    HolidayCalendarModule,
    TransitCacheModule,
    UsersModule,
  ],
  controllers: [TripPlannerController, AdminTripPlannerController],
  providers: [TripPlannerService, TripPlannerCacheService, OptimizerClient],
  exports: [TripPlannerCacheService],
})
export class TripPlannerModule {}
