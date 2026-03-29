import {
  Body,
  Controller,
  Get,
  Header,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateHomeBannerDto } from './dto/update-home-banner.dto';
import { HomeService } from './home.service';

@ApiTags('admin/home')
@Controller('admin/home')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminHomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('banner')
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )
  getBanner() {
    return this.homeService.getBannerBackgroundImage();
  }

  @Patch('banner')
  updateBanner(@Body() dto: UpdateHomeBannerDto) {
    return this.homeService.updateBannerBackgroundImage({
      imageUrl: dto.imageUrl,
    });
  }
}
