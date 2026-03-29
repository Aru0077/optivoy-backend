import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditService } from '../audit/audit.service';
import { AuditActorType } from '../audit/entities/audit-log.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ImportAirportsCsvDto } from './dto/import-airports-csv.dto';
import { AirportCsvImportService } from './airport-csv-import.service';

@ApiTags('admin/locations/airports/import')
@Controller('admin/locations/airports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAirportCsvImportController {
  constructor(
    private readonly airportCsvImportService: AirportCsvImportService,
    private readonly auditService: AuditService,
  ) {}

  @Post('import-csv')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  async importAirportsCsv(
    @Body() dto: ImportAirportsCsvDto,
    @UploadedFile()
    file: { originalname: string; buffer: Buffer } | undefined,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const csvContentFromBody = dto.csvContent?.trim();
    const csvContentFromFile = file?.buffer?.toString('utf8')?.trim();
    const csvContent = csvContentFromFile || csvContentFromBody || '';

    if (!csvContent) {
      throw new BadRequestException({
        code: 'LOCATION_CSV_MISSING_CONTENT',
        message: 'Please upload a CSV file or provide csvContent.',
      });
    }

    const result = await this.airportCsvImportService.importFromCsv({
      filename: file?.originalname || dto.filename,
      datasetType: dto.datasetType,
      csvContent,
    });
    await this.auditService.create({
      actorType: AuditActorType.Admin,
      actorId: req.user.sub,
      action: 'admin.location.csv.imported',
      targetType: `location_${result.datasetType}`,
      metadata: {
        datasetType: result.datasetType,
        filename: result.filename,
        totalRows: result.totalRows,
        validRows: result.validRows,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    });
    return result;
  }
}
