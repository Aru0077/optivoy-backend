import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HomeQueryDto } from './dto/home-query.dto';
import { HomeService } from './home.service';

@ApiTags('home')
@Controller()
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('home')
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )
  getHome(@Query() query: HomeQueryDto) {
    return this.homeService.getHome({ lang: query.lang });
  }
}
