import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HotelPlace } from '../hotels/entities/hotel.entity';
import { LocationAirport } from '../locations/entities/location-airport.entity';
import { RestaurantPlace } from '../restaurants/entities/restaurant.entity';
import { ShoppingPlace } from '../shopping/entities/shopping.entity';
import { Spot } from '../spots/entities/spot.entity';
import { TransitCache } from '../transit-cache/entities/transit-cache.entity';
import { TransitCacheModule } from '../transit-cache/transit-cache.module';
import { UsersModule } from '../users/users.module';
import { AdminMatrixController } from './admin-matrix.controller';
import { MatrixAdminService } from './matrix-admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Spot,
      ShoppingPlace,
      RestaurantPlace,
      HotelPlace,
      LocationAirport,
      TransitCache,
    ]),
    UsersModule,
    TransitCacheModule,
  ],
  controllers: [AdminMatrixController],
  providers: [MatrixAdminService, RolesGuard],
  exports: [MatrixAdminService],
})
export class MatrixAdminModule {}
