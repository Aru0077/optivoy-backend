import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListLocationAirportsQueryDto } from './dto/list-location-airports-query.dto';
import { ListLocationCitiesQueryDto } from './dto/list-location-cities-query.dto';
import { ListLocationProvincesQueryDto } from './dto/list-location-provinces-query.dto';
import { LocationsService } from './locations.service';

@ApiTags('admin/locations')
@Controller('admin/locations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminLocationsController {
  constructor(private readonly locationsService: LocationsService) {}

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

  @Get('matrix-status')
  getPointMatrixStatus(@Query('pointIds') pointIds: string) {
    return this.locationsService.getPointMatrixStatuses(pointIds || '');
  }

  @Delete('airports/:airportId')
  deleteAirport(@Param('airportId') airportId: string) {
    return this.locationsService.deleteAirportById(airportId);
  }
}
