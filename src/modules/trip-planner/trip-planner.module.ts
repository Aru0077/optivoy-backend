import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelPlace } from '../hotels/entities/hotel.entity';
import { ShoppingPlace } from '../shopping/entities/shopping.entity';
import { Spot } from '../spots/entities/spot.entity';
import { TripPlannerAiService } from './trip-planner-ai.service';
import { TripPlannerController } from './trip-planner.controller';
import { TripPlannerService } from './trip-planner.service';

@Module({
  imports: [TypeOrmModule.forFeature([Spot, ShoppingPlace, HotelPlace])],
  controllers: [TripPlannerController],
  providers: [TripPlannerService, TripPlannerAiService],
})
export class TripPlannerModule {}
