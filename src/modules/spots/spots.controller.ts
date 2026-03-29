import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListCityGroupsQueryDto } from './dto/list-city-groups-query.dto';
import { ListSpotsQueryDto } from './dto/list-spots-query.dto';
import { SpotLangQueryDto } from './dto/spot-lang-query.dto';
import { SpotsService } from './spots.service';

@ApiTags('spots')
@Controller('spots')
export class SpotsController {
  constructor(private readonly spotsService: SpotsService) {}

  @Get()
  listSpots(@Query() query: ListSpotsQueryDto) {
    return this.spotsService.listSpots(query);
  }

  @Get('cities')
  listCityGroups(@Query() query: ListCityGroupsQueryDto) {
    return this.spotsService.listCityGroups(query);
  }

  @Get(':spotId')
  getSpotById(
    @Param('spotId') spotId: string,
    @Query() query: SpotLangQueryDto,
  ) {
    return this.spotsService.getSpotById(spotId, query.lang);
  }
}
