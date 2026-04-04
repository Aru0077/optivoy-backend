import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GetCityMatrixStatusQueryDto } from './dto/get-city-matrix-status-query.dto';
import { ListMatrixCitiesQueryDto } from './dto/list-matrix-cities-query.dto';
import { ListMatrixJobsQueryDto } from './dto/list-matrix-jobs-query.dto';
import { RecomputeCityMatrixDto } from './dto/recompute-city-matrix.dto';
import { RecomputePointMatrixDto } from './dto/recompute-point-matrix.dto';
import { MatrixAdminService } from './matrix-admin.service';

@ApiTags('admin/matrix')
@Controller('admin/matrix')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminMatrixController {
  constructor(private readonly matrixAdminService: MatrixAdminService) {}

  @Get('cities')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  listCities(@Query() query: ListMatrixCitiesQueryDto) {
    return this.matrixAdminService.listCities(query);
  }

  @Get('city-status')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  getCityStatus(@Query() query: GetCityMatrixStatusQueryDto) {
    return this.matrixAdminService.getCityStatus(query);
  }

  @Get('jobs')
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  listJobs(@Query() query: ListMatrixJobsQueryDto) {
    return this.matrixAdminService.listJobs(query);
  }

  @Post('recompute-city')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  recomputeCity(@Body() dto: RecomputeCityMatrixDto) {
    return this.matrixAdminService.recomputeCity(dto);
  }

  @Post('recompute-point')
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  recomputePoint(@Body() dto: RecomputePointMatrixDto) {
    return this.matrixAdminService.recomputePoint(dto);
  }
}
