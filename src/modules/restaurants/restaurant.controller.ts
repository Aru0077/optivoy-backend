import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListRestaurantQueryDto } from './dto/list-restaurant-query.dto';
import { RestaurantLangQueryDto } from './dto/restaurant-lang-query.dto';
import { RestaurantService } from './restaurant.service';

@ApiTags('restaurants')
@Controller('restaurants')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  @Get()
  listRestaurant(@Query() query: ListRestaurantQueryDto) {
    return this.restaurantService.listRestaurant(query);
  }

  @Get(':restaurantId')
  getRestaurantById(
    @Param('restaurantId') restaurantId: string,
    @Query() query: RestaurantLangQueryDto,
  ) {
    return this.restaurantService.getRestaurantById(restaurantId, query.lang);
  }
}
