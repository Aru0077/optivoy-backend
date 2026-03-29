import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GenerateItineraryDto } from './dto/generate-itinerary.dto';
import { ListCityPointsQueryDto } from './dto/list-city-points-query.dto';
import { ListTripCitiesQueryDto } from './dto/list-trip-cities-query.dto';
import { TripPlannerService } from './trip-planner.service';

@ApiTags('trip-planner')
@Controller('trip-planner')
export class TripPlannerController {
  constructor(private readonly tripPlannerService: TripPlannerService) {}

  @Get('cities')
  listCities(@Query() query: ListTripCitiesQueryDto) {
    return this.tripPlannerService.listCities(query);
  }

  @Get('cities/:city/points')
  listCityPoints(
    @Param('city') city: string,
    @Query() query: ListCityPointsQueryDto,
  ) {
    return this.tripPlannerService.listCityPoints(city, query);
  }

  @Post('generate')
  generate(@Body() dto: GenerateItineraryDto) {
    return this.tripPlannerService.generateItinerary(dto);
  }
}
