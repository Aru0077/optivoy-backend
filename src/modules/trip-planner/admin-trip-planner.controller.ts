import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GenerateItineraryDto } from './dto/generate-itinerary.dto';
import { TripPlannerService } from './trip-planner.service';

@ApiTags('admin/trip-planner')
@Controller('admin/trip-planner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminTripPlannerController {
  constructor(private readonly tripPlannerService: TripPlannerService) {}

  @Post('matrix-check')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  matrixCheck(@Body() dto: GenerateItineraryDto) {
    return this.tripPlannerService.checkMatrixCoverage(dto);
  }
}
