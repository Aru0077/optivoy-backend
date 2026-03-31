import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { LocationAirport } from './entities/location-airport.entity';
import { LocationCity } from './entities/location-city.entity';
import { LocationCountryRef } from './entities/location-country-ref.entity';
import { LocationProvince } from './entities/location-province.entity';
import { AdminLocationsController } from './admin-locations.controller';
import { LocationRegionRef } from './entities/location-region-ref.entity';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { TransitCacheModule } from '../transit-cache/transit-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LocationCountryRef,
      LocationRegionRef,
      LocationProvince,
      LocationCity,
      LocationAirport,
    ]),
    AuditModule,
    UsersModule,
    TransitCacheModule,
  ],
  controllers: [LocationsController, AdminLocationsController],
  providers: [LocationsService, RolesGuard],
  exports: [LocationsService],
})
export class LocationsModule {}
