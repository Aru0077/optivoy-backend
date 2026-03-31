import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LocationAirport } from '../locations/entities/location-airport.entity';
import { LocationCity } from '../locations/entities/location-city.entity';
import { LocationCountryRef } from '../locations/entities/location-country-ref.entity';
import { LocationProvince } from '../locations/entities/location-province.entity';
import { LocationRegionRef } from '../locations/entities/location-region-ref.entity';
import { TransitCacheModule } from '../transit-cache/transit-cache.module';
import { UsersModule } from '../users/users.module';
import { AdminAirportCsvImportController } from './admin-airport-csv-import.controller';
import { AirportCsvImportService } from './airport-csv-import.service';

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
  controllers: [AdminAirportCsvImportController],
  providers: [AirportCsvImportService, RolesGuard],
  exports: [AirportCsvImportService],
})
export class AirportCsvImportModule {}
