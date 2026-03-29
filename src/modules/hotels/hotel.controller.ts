import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListHotelQueryDto } from './dto/list-hotel-query.dto';
import { HotelLangQueryDto } from './dto/hotel-lang-query.dto';
import { HotelService } from './hotel.service';

@ApiTags('hotels')
@Controller('hotels')
export class HotelController {
  constructor(private readonly hotelService: HotelService) {}

  @Get()
  listHotel(@Query() query: ListHotelQueryDto) {
    return this.hotelService.listHotel(query);
  }

  @Get(':hotelId')
  getHotelById(
    @Param('hotelId') hotelId: string,
    @Query() query: HotelLangQueryDto,
  ) {
    return this.hotelService.getHotelById(hotelId, query.lang);
  }
}
