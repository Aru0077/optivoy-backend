import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelPlace } from '../hotels/entities/hotel.entity';
import { ShoppingPlace } from '../shopping/entities/shopping.entity';
import { Spot } from '../spots/entities/spot.entity';
import { AmapTransitClient } from './amap/amap-transit.client';
import { TransitCache } from './entities/transit-cache.entity';
import { TransitCachePrecomputeService } from './transit-cache-precompute.service';
import { TransitCacheService } from './transit-cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransitCache, Spot, ShoppingPlace, HotelPlace]),
  ],
  providers: [
    TransitCacheService,
    AmapTransitClient,
    TransitCachePrecomputeService,
  ],
  exports: [
    TransitCacheService,
    TransitCachePrecomputeService,
    AmapTransitClient,
  ],
})
export class TransitCacheModule {}
