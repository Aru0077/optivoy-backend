import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListLocationCitiesQueryDto } from './dto/list-location-cities-query.dto';
import { ListLocationCountriesQueryDto } from './dto/list-location-countries-query.dto';
import { ListLocationAirportsQueryDto } from './dto/list-location-airports-query.dto';
import { ListLocationProvincesQueryDto } from './dto/list-location-provinces-query.dto';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('countries')
  listCountries(@Query() query: ListLocationCountriesQueryDto) {
    return this.locationsService.listCountries(query);
  }

  @Get('provinces')
  listProvinces(@Query() query: ListLocationProvincesQueryDto) {
    return this.locationsService.listProvinces(query);
  }

  @Get('cities')
  listCities(@Query() query: ListLocationCitiesQueryDto) {
    return this.locationsService.listCities(query);
  }

  @Get('airports')
  listAirports(@Query() query: ListLocationAirportsQueryDto) {
    return this.locationsService.listAirports(query);
  }
}
