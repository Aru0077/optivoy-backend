import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { SystemMessageI18nService } from '../../common/i18n/system-message-i18n.service';
import { HotelPlace } from '../hotels/entities/hotel.entity';
import { ShoppingPlace } from '../shopping/entities/shopping.entity';
import { Spot } from '../spots/entities/spot.entity';
import {
  TransitCache,
  TransitCachePointType,
  TransitCacheStatus,
} from '../transit-cache/entities/transit-cache.entity';
import {
  TransitCachePrecomputeService,
  TransitPointNeighborhoodRecomputeSummary,
} from '../transit-cache/transit-cache-precompute.service';
import { GetCityMatrixStatusQueryDto } from './dto/get-city-matrix-status-query.dto';
import { ListMatrixCitiesQueryDto } from './dto/list-matrix-cities-query.dto';
import { ListMatrixJobsQueryDto } from './dto/list-matrix-jobs-query.dto';
import { RecomputeCityMatrixDto } from './dto/recompute-city-matrix.dto';
import { RecomputePointMatrixDto } from './dto/recompute-point-matrix.dto';
import {
  MatrixRecomputeJob,
  MatrixRecomputeJobStatus,
  MatrixRecomputeMode,
  MatrixRecomputeScope,
} from './entities/matrix-recompute-job.entity';

interface MatrixCityRef {
  city: string;
  province: string | null;
}

interface MatrixNode {
  id: string;
  pointType: TransitCachePointType;
  name: string;
  city: string;
  province: string | null;
  cityI18n?: Record<string, string | undefined> | null;
  latitude: number;
  longitude: number;
  entryLatitude?: number;
  entryLongitude?: number;
  exitLatitude?: number;
  exitLongitude?: number;
}

interface MatrixEdgeRow {
  fromPointId: string;
  toPointId: string;
  status: TransitCacheStatus;
  transitMinutes: number;
  drivingMinutes: number;
  walkingMeters: number;
  walkingMinutes: number;
  transitProviderStatus: string | null;
  updatedAt: Date;
}

export type MatrixCityStatus =
  | 'ready'
  | 'partial'
  | 'stale'
  | 'failed'
  | 'pending';

export type MatrixNodeStatus = 'ready' | 'partial' | 'pending';

export interface MatrixCoverageSummary {
  expected: number;
  ready: number;
  missing: number;
  coverage: number;
}

export interface MatrixNodeCountSummary {
  total: number;
  spot: number;
  shopping: number;
  hotel: number;
}

export interface MatrixModeCoverageSummary {
  readyEdgeCount: number;
  transitReadyEdges: number;
  transitFallbackEdges: number;
  transitNoRouteEdges: number;
  drivingMinutesPresent: number;
  walkingMetersPresent: number;
  walkingMinutesPresent: number;
  transitMinutesPresent: number;
  hasTransit: boolean;
  hasDriving: boolean;
  hasWalking: boolean;
  transitCoverage: number;
  drivingCoverage: number;
  walkingCoverage: number;
  walkingMinutesCoverage: number;
  fallbackEdgeRatio: number;
  noRouteEdgeRatio: number;
}

export interface MatrixAnchorMissingItem {
  pointId: string;
  pointType: TransitCachePointType;
  name: string;
  missingAnchors: string[];
}

export interface MatrixSolverIssueSummary {
  reason: string;
  count: number;
  samples: string[];
}

export interface MatrixDiagnosticsSummary {
  anchorMissingCount: number;
  anchorMissingSample: MatrixAnchorMissingItem[];
  solverIssueSummary: MatrixSolverIssueSummary[];
}

export interface MatrixCityNodeItem {
  id: string;
  pointType: TransitCachePointType;
  name: string;
  city: string;
  province: string | null;
  latitude: number;
  longitude: number;
  outReadyEdges: number;
  inReadyEdges: number;
  outMissingEdges: number;
  inMissingEdges: number;
  modeReadyEdges: number;
  expectedModeEdges: number;
  status: MatrixNodeStatus;
}

export interface MatrixMissingEdgeItem {
  fromPointId: string;
  fromPointType: TransitCachePointType;
  fromName: string;
  toPointId: string;
  toPointType: TransitCachePointType;
  toName: string;
}

export interface MatrixCityStatusBase {
  city: string;
  province: string | null;
  nodeCount: MatrixNodeCountSummary;
  status: MatrixCityStatus;
  directed: MatrixCoverageSummary;
  undirected: MatrixCoverageSummary;
  modeCoverage: MatrixModeCoverageSummary;
  diagnostics: MatrixDiagnosticsSummary;
  canGenerate: boolean;
  lastUpdatedAt: string | null;
}

export interface MatrixCityStatusItem extends MatrixCityStatusBase {
  nodes: MatrixCityNodeItem[];
  missingEdgesSample: MatrixMissingEdgeItem[];
}

export interface MatrixCityListItem extends MatrixCityStatusBase {}

export interface MatrixRecomputeJobItem {
  id: string;
  scope: MatrixRecomputeScope;
  city: string;
  province: string | null;
  pointId: string | null;
  pointType: TransitCachePointType | null;
  modes: MatrixRecomputeMode[];
  status: MatrixRecomputeJobStatus;
  totalEdges: number;
  processedEdges: number;
  transitReadyEdges: number;
  transitFallbackEdges: number;
  transitNoRouteEdges: number;
  drivingReadyEdges: number;
  walkingReadyEdges: number;
  walkingMinutesReadyEdges: number;
  message: string | null;
  lastError: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class MatrixAdminService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatrixAdminService.name);
  private jobWorkerTimer: NodeJS.Timeout | null = null;
  private jobWorkerRunning = false;
  private matrixJobsTableReady: boolean | null = null;

  constructor(
    @InjectRepository(Spot)
    private readonly spotRepository: Repository<Spot>,
    @InjectRepository(ShoppingPlace)
    private readonly shoppingRepository: Repository<ShoppingPlace>,
    @InjectRepository(HotelPlace)
    private readonly hotelRepository: Repository<HotelPlace>,
    @InjectRepository(TransitCache)
    private readonly transitCacheRepository: Repository<TransitCache>,
    @InjectRepository(MatrixRecomputeJob)
    private readonly matrixRecomputeJobRepository: Repository<MatrixRecomputeJob>,
    private readonly transitCachePrecomputeService: TransitCachePrecomputeService,
    private readonly i18n: I18nService,
    private readonly systemMessageI18nService: SystemMessageI18nService,
  ) {}

  onModuleInit(): void {
    this.jobWorkerTimer = setInterval(() => {
      void this.runPendingMatrixJob();
    }, 3000);
    void this.runPendingMatrixJob();
  }

  onModuleDestroy(): void {
    if (this.jobWorkerTimer) {
      clearInterval(this.jobWorkerTimer);
      this.jobWorkerTimer = null;
    }
  }

  async listCities(query: ListMatrixCitiesQueryDto): Promise<{
    total: number;
    items: MatrixCityListItem[];
  }> {
    const refs = await this.listCityRefs();
    const filtered = refs.filter((item) => this.matchCityRef(item, query));
    const paged = filtered.slice(query.offset, query.offset + query.limit);

    const items = await Promise.all(
      paged.map(async (item) => {
        const detail = await this.computeCityStatus(item.city, item.province, {
          includeNodes: false,
          includeMissingSample: false,
        });
        const { nodes, missingEdgesSample, ...summary } = detail;
        return summary;
      }),
    );

    return {
      total: filtered.length,
      items,
    };
  }

  async getCityStatus(
    query: GetCityMatrixStatusQueryDto,
  ): Promise<MatrixCityStatusItem> {
    const city = this.normalizeRequired(query.city, 'city');
    const province = this.normalizeOptional(query.province);
    return this.computeCityStatus(city, province, {
      includeNodes: true,
      includeMissingSample: true,
    });
  }

  async listJobs(query: ListMatrixJobsQueryDto): Promise<{
    items: MatrixRecomputeJobItem[];
  }> {
    if (!(await this.ensureMatrixJobsTableReady())) {
      return { items: [] };
    }

    const qb = this.matrixRecomputeJobRepository
      .createQueryBuilder('job')
      .orderBy('job.createdAt', 'DESC')
      .take(query.limit);

    const city = this.normalizeOptional(query.city);
    const province = this.normalizeOptional(query.province);
    if (city) {
      qb.where('LOWER(job.city) = LOWER(:city)', { city });
    }
    if (province) {
      if (city) {
        qb.andWhere('LOWER(job.province) = LOWER(:province)', { province });
      } else {
        qb.where('LOWER(job.province) = LOWER(:province)', { province });
      }
    }

    const jobs = await qb.getMany();
    return {
      items: jobs.map((job) => this.toJobItem(job)),
    };
  }

  async removeJob(jobId: string): Promise<void> {
    const normalizedJobId = this.normalizeRequired(jobId, 'jobId');
    if (!(await this.ensureMatrixJobsTableReady())) {
      throw new BadRequestException({
        code: 'MATRIX_RECOMPUTE_JOB_TABLE_UNAVAILABLE',
        message: 'Matrix recompute jobs table is unavailable.',
      });
    }

    const job = await this.matrixRecomputeJobRepository.findOne({
      where: { id: normalizedJobId },
    });
    if (!job) {
      throw new NotFoundException({
        code: 'MATRIX_RECOMPUTE_JOB_NOT_FOUND',
        message: 'Matrix recompute job not found.',
      });
    }

    if (job.status === 'pending' || job.status === 'running') {
      throw new BadRequestException({
        code: 'MATRIX_RECOMPUTE_JOB_DELETE_FORBIDDEN',
        message: 'Running or pending matrix jobs cannot be deleted.',
      });
    }

    await this.matrixRecomputeJobRepository.delete({ id: normalizedJobId });
  }

  async recomputeCity(dto: RecomputeCityMatrixDto): Promise<{
    accepted: true;
    job: MatrixRecomputeJobItem;
    message: string;
  }> {
    const city = this.normalizeRequired(dto.city, 'city');
    const province = this.normalizeOptional(dto.province);
    const job = await this.createMatrixJob({
      scope: 'city',
      city,
      province,
      modes: this.normalizeModes(dto.modes, ['transit', 'driving', 'walking']),
    });

    return {
      accepted: true,
      job: this.toJobItem(job),
      message: 'Matrix recompute job queued.',
    };
  }

  async recomputePoint(dto: RecomputePointMatrixDto): Promise<{
    accepted: true;
    job: MatrixRecomputeJobItem;
    message: string;
  }> {
    const pointId = this.normalizeRequired(dto.pointId, 'pointId');
    const point = await this.resolvePointById(pointId);

    const hasCenterCoordinate =
      Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
    const hasSpotEntryExitCoordinate =
      point.pointType === 'spot' &&
      Number.isFinite(point.entryLatitude) &&
      Number.isFinite(point.entryLongitude) &&
      Number.isFinite(point.exitLatitude) &&
      Number.isFinite(point.exitLongitude);

    const coordinateInvalid =
      point.pointType === 'spot' ? !hasSpotEntryExitCoordinate : !hasCenterCoordinate;

    if (coordinateInvalid) {
      throw new BadRequestException({
        code: 'MATRIX_POINT_COORDINATE_REQUIRED',
        message: 'Point coordinates are required for recompute.',
      });
    }

    const job = await this.createMatrixJob({
      scope: 'point',
      city: point.city,
      province: point.province,
      pointId: point.id,
      pointType: point.pointType,
      modes: this.normalizeModes(dto.modes, ['transit']),
    });

    return {
      accepted: true,
      job: this.toJobItem(job),
      message: 'Matrix point recompute job queued.',
    };
  }

  private async createMatrixJob(input: {
    scope: MatrixRecomputeScope;
    city: string;
    province: string | null;
    pointId?: string;
    pointType?: TransitCachePointType;
    modes: MatrixRecomputeMode[];
  }): Promise<MatrixRecomputeJob> {
    if (!(await this.ensureMatrixJobsTableReady())) {
      throw new BadRequestException({
        code: 'MATRIX_RECOMPUTE_JOB_TABLE_UNAVAILABLE',
        message: 'Matrix recompute jobs table is unavailable.',
      });
    }

    const job = this.matrixRecomputeJobRepository.create({
      scope: input.scope,
      city: input.city,
      province: input.province,
      pointId: input.pointId ?? null,
      pointType: input.pointType ?? null,
      modes: input.modes,
      status: 'pending',
      totalEdges: 0,
      processedEdges: 0,
      transitReadyEdges: 0,
      transitFallbackEdges: 0,
      transitNoRouteEdges: 0,
      drivingReadyEdges: 0,
      walkingReadyEdges: 0,
      walkingMinutesReadyEdges: 0,
      message: null,
      lastError: null,
      startedAt: null,
      finishedAt: null,
    });
    return this.matrixRecomputeJobRepository.save(job);
  }

  private normalizeModes(
    modes: MatrixRecomputeMode[] | undefined,
    defaultModes: MatrixRecomputeMode[],
  ): MatrixRecomputeMode[] {
    const normalized = Array.from(
      new Set((modes ?? defaultModes).filter((item) => !!item)),
    );
    return normalized.length > 0 ? normalized : defaultModes;
  }

  private toJobItem(job: MatrixRecomputeJob): MatrixRecomputeJobItem {
    const lang = this.systemMessageI18nService.getCurrentLang();

    return {
      id: job.id,
      scope: job.scope,
      city: job.city,
      province: job.province,
      pointId: job.pointId,
      pointType: job.pointType,
      modes: Array.isArray(job.modes) ? job.modes : [],
      status: job.status,
      totalEdges: job.totalEdges,
      processedEdges: job.processedEdges,
      transitReadyEdges: job.transitReadyEdges,
      transitFallbackEdges: job.transitFallbackEdges,
      transitNoRouteEdges: job.transitNoRouteEdges,
      drivingReadyEdges: job.drivingReadyEdges,
      walkingReadyEdges: job.walkingReadyEdges,
      walkingMinutesReadyEdges: job.walkingMinutesReadyEdges,
      message: this.resolveJobMessage(job, lang),
      lastError:
        job.lastError && lang
          ? this.systemMessageI18nService.translateSystemMessage({
              message: job.lastError,
              lang,
            })
          : job.lastError,
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  private async ensureMatrixJobsTableReady(): Promise<boolean> {
    if (this.matrixJobsTableReady === true) {
      return this.matrixJobsTableReady;
    }

    try {
      await this.matrixRecomputeJobRepository.query(
        'SELECT 1 FROM "matrix_recompute_jobs" LIMIT 1',
      );
      this.matrixJobsTableReady = true;
    } catch (error) {
      this.matrixJobsTableReady = null;
      this.logger.warn(
        `Matrix recompute jobs table unavailable: ${(error as Error).message}`,
      );
      return false;
    }

    return true;
  }

  private async runPendingMatrixJob(): Promise<void> {
    if (this.jobWorkerRunning || !(await this.ensureMatrixJobsTableReady())) {
      return;
    }

    this.jobWorkerRunning = true;
    try {
      const job = await this.claimNextPendingJob();
      if (!job) {
        return;
      }
      await this.processMatrixJob(job);
    } finally {
      this.jobWorkerRunning = false;
    }
  }

  private async claimNextPendingJob(): Promise<MatrixRecomputeJob | null> {
    const job = await this.matrixRecomputeJobRepository.findOne({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
    });
    if (!job) {
      return null;
    }

    const updateResult = await this.matrixRecomputeJobRepository
      .createQueryBuilder()
      .update(MatrixRecomputeJob)
      .set({
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
        lastError: null,
        message: 'Processing...',
        processedEdges: 0,
        transitReadyEdges: 0,
        transitFallbackEdges: 0,
        transitNoRouteEdges: 0,
        drivingReadyEdges: 0,
        walkingReadyEdges: 0,
        walkingMinutesReadyEdges: 0,
      })
      .where('id = :id', { id: job.id })
      .andWhere('status = :status', { status: 'pending' })
      .execute();

    if (!updateResult.affected) {
      return null;
    }

    return this.matrixRecomputeJobRepository.findOne({ where: { id: job.id } });
  }

  private async processMatrixJob(job: MatrixRecomputeJob): Promise<void> {
    if (!job) {
      return;
    }

    try {
      const nodes = await this.loadCityNodes(job.city, job.province);
      const nodeIds = Array.from(new Set(nodes.map((item) => item.id)));
      const totalEdges =
        job.scope === 'city'
          ? nodeIds.length <= 1
            ? 0
            : nodeIds.length * (nodeIds.length - 1)
          : nodeIds.length <= 1
            ? 0
            : (nodeIds.length - 1) * 2;

      job.totalEdges = totalEdges;
      job.message = this.buildJobQueuedMessage(job);
      await this.matrixRecomputeJobRepository.save(job);

      if (job.scope === 'city') {
        await this.transitCachePrecomputeService.recomputeCity(
          job.city,
          job.province,
          {
            modes: job.modes,
            onChunkProgress: (chunk) =>
              this.applyJobChunkProgress(job.id, chunk),
          },
        );
      } else {
        const point = await this.resolvePointById(job.pointId as string);
        const summary =
          await this.transitCachePrecomputeService.recomputePointNeighborhood(
            {
              id: point.id,
              pointType: point.pointType,
              city: point.city,
              province: point.province,
              cityI18n: point.cityI18n ?? null,
              latitude: point.latitude,
              longitude: point.longitude,
              entryLatitude: point.entryLatitude,
              entryLongitude: point.entryLongitude,
              exitLatitude: point.exitLatitude,
              exitLongitude: point.exitLongitude,
            },
            {
              modes: job.modes,
              onChunkProgress: (chunk) =>
                this.applyJobChunkProgress(job.id, chunk),
            },
          );
        job.message = this.buildPointRecomputeMessage(summary);
      }

      const refreshed = await this.matrixRecomputeJobRepository.findOneOrFail({
        where: { id: job.id },
      });
      refreshed.status = this.resolveMatrixJobStatus(refreshed);
      refreshed.message =
        refreshed.message || this.buildJobCompletionMessage(refreshed);
      refreshed.finishedAt = new Date();
      await this.matrixRecomputeJobRepository.save(refreshed);
    } catch (error) {
      const message = (error as Error).message;
      job.status = /CUQPS_HAS_EXCEEDED_THE_LIMIT/i.test(message)
        ? 'rate_limited'
        : 'failed';
      job.lastError = message;
      job.message = 'Matrix recompute job failed.';
      job.finishedAt = new Date();
      await this.matrixRecomputeJobRepository.save(job);
      this.logger.warn(
        `Matrix recompute job failed jobId=${job.id}: ${message}`,
      );
    }
  }

  private async applyJobChunkProgress(
    jobId: string,
    chunk: {
      totalEdges: number;
      transitReadyEdges: number;
      transitFallbackEdges: number;
      transitNoRouteEdges: number;
      drivingReadyEdges: number;
      walkingReadyEdges: number;
      walkingMinutesReadyEdges: number;
    },
  ): Promise<void> {
    await this.matrixRecomputeJobRepository
      .createQueryBuilder()
      .update(MatrixRecomputeJob)
      .set({
        processedEdges: () => `"processedEdges" + ${chunk.totalEdges}`,
        transitReadyEdges: () =>
          `"transitReadyEdges" + ${chunk.transitReadyEdges}`,
        transitFallbackEdges: () =>
          `"transitFallbackEdges" + ${chunk.transitFallbackEdges}`,
        transitNoRouteEdges: () =>
          `"transitNoRouteEdges" + ${chunk.transitNoRouteEdges}`,
        drivingReadyEdges: () =>
          `"drivingReadyEdges" + ${chunk.drivingReadyEdges}`,
        walkingReadyEdges: () =>
          `"walkingReadyEdges" + ${chunk.walkingReadyEdges}`,
        walkingMinutesReadyEdges: () =>
          `"walkingMinutesReadyEdges" + ${chunk.walkingMinutesReadyEdges}`,
        message: 'Processing...',
      })
      .where('id = :id', { id: jobId })
      .execute();
  }

  private resolveMatrixJobStatus(
    job: MatrixRecomputeJob,
  ): MatrixRecomputeJobStatus {
    const expected = Math.max(0, job.totalEdges);
    if (expected === 0) {
      return 'completed';
    }

    let allSelectedModesReady = true;
    if (job.modes.includes('transit')) {
      allSelectedModesReady =
        allSelectedModesReady && job.transitReadyEdges >= expected;
    }
    if (job.modes.includes('driving')) {
      allSelectedModesReady =
        allSelectedModesReady && job.drivingReadyEdges >= expected;
    }
    if (job.modes.includes('walking')) {
      allSelectedModesReady =
        allSelectedModesReady &&
        job.walkingReadyEdges >= expected &&
        job.walkingMinutesReadyEdges >= expected;
    }

    if (allSelectedModesReady && job.processedEdges >= expected) {
      return 'completed';
    }
    return job.processedEdges > 0 ? 'partial' : 'failed';
  }

  private buildJobQueuedMessage(job: MatrixRecomputeJob): string {
    const modeText = job.modes.join(' / ') || 'transit';
    if (job.scope === 'point') {
      return `Queued point recompute for modes: ${modeText}.`;
    }
    return `Queued city recompute for modes: ${modeText}.`;
  }

  private buildJobCompletionMessage(job: MatrixRecomputeJob): string {
    const segments: string[] = [];
    if (job.modes.includes('transit')) {
      segments.push(`公交 ready ${job.transitReadyEdges}/${job.totalEdges}`);
      if (job.transitFallbackEdges > 0) {
        segments.push(`fallback ${job.transitFallbackEdges}/${job.totalEdges}`);
      }
      if (job.transitNoRouteEdges > 0) {
        segments.push(`no_route ${job.transitNoRouteEdges}/${job.totalEdges}`);
      }
    }
    if (job.modes.includes('driving')) {
      segments.push(`驾车 ${job.drivingReadyEdges}/${job.totalEdges}`);
    }
    if (job.modes.includes('walking')) {
      segments.push(`步行 ${job.walkingReadyEdges}/${job.totalEdges}`);
    }
    return segments.length > 0
      ? segments.join('，')
      : 'Matrix recompute job completed.';
  }

  private resolveJobMessage(
    job: MatrixRecomputeJob,
    lang?: string,
  ): string | null {
    if (!lang) {
      return job.message;
    }

    if (job.status === 'pending') {
      const modes = this.formatJobModes(job, lang);
      return this.i18n.translate(
        job.scope === 'point'
          ? 'system.MATRIX_POINT_RECOMPUTE_JOB_QUEUED_WITH_MODES'
          : 'system.MATRIX_RECOMPUTE_JOB_QUEUED_WITH_MODES',
        {
          lang,
          args: { modes },
          defaultValue: job.message ?? 'Matrix recompute job queued.',
        },
      );
    }

    if (job.status === 'running') {
      return this.i18n.translate('system.MATRIX_JOB_PROCESSING', {
        lang,
        defaultValue: 'Processing...',
      });
    }

    if (job.status === 'failed') {
      return this.i18n.translate('system.MATRIX_RECOMPUTE_JOB_FAILED', {
        lang,
        defaultValue: job.message ?? 'Matrix recompute job failed.',
      });
    }

    const segments: string[] = [];
    if (job.modes.includes('transit')) {
      segments.push(
        this.i18n.translate('system.MATRIX_TRANSIT_READY_SEGMENT', {
          lang,
          args: {
            ready: job.transitReadyEdges,
            total: job.totalEdges,
          },
          defaultValue: `Transit ${job.transitReadyEdges}/${job.totalEdges}`,
        }),
      );
      if (job.transitFallbackEdges > 0) {
        segments.push(
          this.i18n.translate('system.MATRIX_TRANSIT_FALLBACK_SEGMENT', {
            lang,
            args: {
              ready: job.transitFallbackEdges,
              total: job.totalEdges,
            },
            defaultValue: `fallback ${job.transitFallbackEdges}/${job.totalEdges}`,
          }),
        );
      }
      if (job.transitNoRouteEdges > 0) {
        segments.push(
          this.i18n.translate('system.MATRIX_TRANSIT_NO_ROUTE_SEGMENT', {
            lang,
            args: {
              ready: job.transitNoRouteEdges,
              total: job.totalEdges,
            },
            defaultValue: `no_route ${job.transitNoRouteEdges}/${job.totalEdges}`,
          }),
        );
      }
    }
    if (job.modes.includes('driving')) {
      segments.push(
        this.i18n.translate('system.MATRIX_DRIVING_READY_SEGMENT', {
          lang,
          args: {
            ready: job.drivingReadyEdges,
            total: job.totalEdges,
          },
          defaultValue: `Driving ${job.drivingReadyEdges}/${job.totalEdges}`,
        }),
      );
    }
    if (job.modes.includes('walking')) {
      segments.push(
        this.i18n.translate('system.MATRIX_WALKING_READY_SEGMENT', {
          lang,
          args: {
            ready: job.walkingReadyEdges,
            total: job.totalEdges,
          },
          defaultValue: `Walking ${job.walkingReadyEdges}/${job.totalEdges}`,
        }),
      );
    }

    if (segments.length > 0) {
      return segments.join(', ');
    }

    return this.i18n.translate('system.MATRIX_RECOMPUTE_JOB_COMPLETED', {
      lang,
      defaultValue: 'Matrix recompute job completed.',
    });
  }

  private formatJobModes(job: MatrixRecomputeJob, lang: string): string {
    const modeLabels = job.modes.map((mode) =>
      this.i18n.translate(`system.MATRIX_MODE_${mode.toUpperCase()}`, {
        lang,
        defaultValue: mode,
      }),
    );
    return modeLabels.join(' / ');
  }

  private async computeCityStatus(
    city: string,
    province: string | null,
    options: {
      includeNodes: boolean;
      includeMissingSample: boolean;
    },
  ): Promise<MatrixCityStatusItem> {
    const nodes = await this.loadCityNodes(city, province);
    const uniqueNodeIds = Array.from(new Set(nodes.map((item) => item.id)));
    const nodeById = new Map(nodes.map((item) => [item.id, item] as const));

    const nodeCount: MatrixNodeCountSummary = {
      total: nodes.length,
      spot: nodes.filter((item) => item.pointType === 'spot').length,
      shopping: nodes.filter((item) => item.pointType === 'shopping').length,
      hotel: nodes.filter((item) => item.pointType === 'hotel').length,
    };

    const expectedDirected =
      uniqueNodeIds.length <= 1
        ? 0
        : uniqueNodeIds.length * (uniqueNodeIds.length - 1);

    let readyDirected = 0;
    let staleDirected = 0;
    let failedDirected = 0;
    const readyDirectedSet = new Set<string>();
    const outReadyByNode = new Map<string, number>();
    const inReadyByNode = new Map<string, number>();
    const outModeReadyByNode = new Map<string, number>();
    const inModeReadyByNode = new Map<string, number>();

    let transitReadyEdges = 0;
    let transitFallbackEdges = 0;
    let transitNoRouteEdges = 0;
    let drivingMinutesPresent = 0;
    let walkingMetersPresent = 0;
    let walkingMinutesPresent = 0;
    let transitMinutesPresent = 0;
    let latestUpdatedAt: Date | null = null;

    if (uniqueNodeIds.length > 1) {
      const edges = await this.loadCityEdges(city, province, uniqueNodeIds);
      for (const edge of edges) {
        if (!nodeById.has(edge.fromPointId) || !nodeById.has(edge.toPointId)) {
          continue;
        }
        if (edge.fromPointId === edge.toPointId) {
          continue;
        }

        const key = this.buildEdgeKey(edge.fromPointId, edge.toPointId);
        if (edge.status === 'ready') {
          if (!readyDirectedSet.has(key)) {
            readyDirectedSet.add(key);
            outReadyByNode.set(
              edge.fromPointId,
              (outReadyByNode.get(edge.fromPointId) || 0) + 1,
            );
            inReadyByNode.set(
              edge.toPointId,
              (inReadyByNode.get(edge.toPointId) || 0) + 1,
            );
            if (edge.drivingMinutes > 0) {
              drivingMinutesPresent += 1;
            }
            if (edge.transitMinutes > 0) {
              transitMinutesPresent += 1;
            }
            if (edge.walkingMeters > 0) {
              walkingMetersPresent += 1;
            }
            if (edge.walkingMinutes > 0) {
              walkingMinutesPresent += 1;
            }
            if (edge.transitProviderStatus === 'ready') {
              transitReadyEdges += 1;
            } else if (edge.transitProviderStatus === 'fallback') {
              transitFallbackEdges += 1;
            } else if (edge.transitProviderStatus === 'no_route') {
              transitNoRouteEdges += 1;
            }
            if (
              edge.drivingMinutes > 0 &&
              edge.walkingMeters > 0 &&
              edge.walkingMinutes > 0 &&
              edge.transitProviderStatus === 'ready'
            ) {
              outModeReadyByNode.set(
                edge.fromPointId,
                (outModeReadyByNode.get(edge.fromPointId) || 0) + 1,
              );
              inModeReadyByNode.set(
                edge.toPointId,
                (inModeReadyByNode.get(edge.toPointId) || 0) + 1,
              );
            }
          }
          if (!latestUpdatedAt || edge.updatedAt > latestUpdatedAt) {
            latestUpdatedAt = edge.updatedAt;
          }
          continue;
        }

        if (edge.status === 'stale') {
          staleDirected += 1;
          continue;
        }

        failedDirected += 1;
      }
    }

    readyDirected = readyDirectedSet.size;

    const expectedUndirected =
      uniqueNodeIds.length <= 1
        ? 0
        : (uniqueNodeIds.length * (uniqueNodeIds.length - 1)) / 2;

    let readyUndirected = 0;
    const missingEdgesSample: MatrixMissingEdgeItem[] = [];
    const maxMissingSample = options.includeMissingSample ? 120 : 0;

    for (let i = 0; i < uniqueNodeIds.length; i += 1) {
      for (let j = i + 1; j < uniqueNodeIds.length; j += 1) {
        const fromPointId = uniqueNodeIds[i];
        const toPointId = uniqueNodeIds[j];
        const direct = this.buildEdgeKey(fromPointId, toPointId);
        const reverse = this.buildEdgeKey(toPointId, fromPointId);

        if (readyDirectedSet.has(direct) || readyDirectedSet.has(reverse)) {
          readyUndirected += 1;
          continue;
        }

        if (missingEdgesSample.length < maxMissingSample) {
          const from = nodeById.get(fromPointId);
          const to = nodeById.get(toPointId);
          if (from && to) {
            missingEdgesSample.push({
              fromPointId,
              fromPointType: from.pointType,
              fromName: from.name,
              toPointId,
              toPointType: to.pointType,
              toName: to.name,
            });
          }
        }
      }
    }

    const nodesDetail = options.includeNodes
      ? this.buildNodeDetails(
          uniqueNodeIds,
          nodeById,
          outReadyByNode,
          inReadyByNode,
          outModeReadyByNode,
          inModeReadyByNode,
        )
      : [];

    const directed: MatrixCoverageSummary = {
      expected: expectedDirected,
      ready: readyDirected,
      missing: Math.max(0, expectedDirected - readyDirected),
      coverage: this.toCoverage(expectedDirected, readyDirected),
    };

    const undirected: MatrixCoverageSummary = {
      expected: expectedUndirected,
      ready: readyUndirected,
      missing: Math.max(0, expectedUndirected - readyUndirected),
      coverage: this.toCoverage(expectedUndirected, readyUndirected),
    };

    const modeCoverage: MatrixModeCoverageSummary = {
      readyEdgeCount: readyDirected,
      transitReadyEdges,
      transitFallbackEdges,
      transitNoRouteEdges,
      drivingMinutesPresent,
      walkingMetersPresent,
      walkingMinutesPresent,
      transitMinutesPresent,
      hasTransit: transitReadyEdges > 0,
      hasDriving: drivingMinutesPresent > 0,
      hasWalking: walkingMetersPresent > 0,
      transitCoverage: this.toCoverage(readyDirected, transitReadyEdges),
      drivingCoverage: this.toCoverage(readyDirected, drivingMinutesPresent),
      walkingCoverage: this.toCoverage(readyDirected, walkingMetersPresent),
      walkingMinutesCoverage: this.toCoverage(
        readyDirected,
        walkingMinutesPresent,
      ),
      fallbackEdgeRatio: this.toCoverage(readyDirected, transitFallbackEdges),
      noRouteEdgeRatio: this.toCoverage(readyDirected, transitNoRouteEdges),
    };

    const diagnostics = await this.buildCityDiagnostics(city, province);

    return {
      city,
      province,
      nodeCount,
      status: this.resolveCityStatus({
        expectedDirected,
        readyDirected,
        staleDirected,
        failedDirected,
        modeCoverage,
      }),
      directed,
      undirected,
      modeCoverage,
      diagnostics,
      canGenerate: undirected.missing === 0,
      lastUpdatedAt: latestUpdatedAt ? latestUpdatedAt.toISOString() : null,
      nodes: nodesDetail,
      missingEdgesSample,
    };
  }

  private buildNodeDetails(
    nodeIds: string[],
    nodeById: Map<string, MatrixNode>,
    outReadyByNode: Map<string, number>,
    inReadyByNode: Map<string, number>,
    outModeReadyByNode: Map<string, number>,
    inModeReadyByNode: Map<string, number>,
  ): MatrixCityNodeItem[] {
    const peerCount = Math.max(0, nodeIds.length - 1);

    const rows: MatrixCityNodeItem[] = [];
    for (const nodeId of nodeIds) {
      const node = nodeById.get(nodeId);
      if (!node) {
        continue;
      }

      const outReadyEdges = outReadyByNode.get(nodeId) || 0;
      const inReadyEdges = inReadyByNode.get(nodeId) || 0;
      const outMissingEdges = Math.max(0, peerCount - outReadyEdges);
      const inMissingEdges = Math.max(0, peerCount - inReadyEdges);
      const outModeReadyEdges = outModeReadyByNode.get(nodeId) || 0;
      const inModeReadyEdges = inModeReadyByNode.get(nodeId) || 0;
      const expectedTotal = peerCount * 2;
      const readyTotal = outReadyEdges + inReadyEdges;
      const modeReadyTotal = outModeReadyEdges + inModeReadyEdges;

      let status: MatrixNodeStatus = 'pending';
      if (
        expectedTotal > 0 &&
        readyTotal === expectedTotal &&
        modeReadyTotal === expectedTotal
      ) {
        status = 'ready';
      } else if (readyTotal > 0 || modeReadyTotal > 0) {
        status = 'partial';
      }

      rows.push({
        id: node.id,
        pointType: node.pointType,
        name: node.name,
        city: node.city,
        province: node.province,
        latitude: node.latitude,
        longitude: node.longitude,
        outReadyEdges,
        inReadyEdges,
        outMissingEdges,
        inMissingEdges,
        modeReadyEdges: modeReadyTotal,
        expectedModeEdges: expectedTotal,
        status,
      });
    }

    return rows.sort((a, b) => {
      const aMissing = a.outMissingEdges + a.inMissingEdges;
      const bMissing = b.outMissingEdges + b.inMissingEdges;
      if (aMissing !== bMissing) {
        return bMissing - aMissing;
      }
      if (a.pointType !== b.pointType) {
        return a.pointType.localeCompare(b.pointType);
      }
      return a.name.localeCompare(b.name);
    });
  }

  private async loadCityNodes(
    city: string,
    province: string | null,
  ): Promise<MatrixNode[]> {
    const [spots, shopping, hotels] = await Promise.all([
      this.spotRepository
        .createQueryBuilder('spot')
        .select([
          'spot.id AS id',
          'spot.name AS name',
          'spot.city AS city',
          'spot.province AS province',
          'spot."entryLatitude" AS latitude',
          'spot."entryLongitude" AS longitude',
        ])
        .where('spot."isPublished" = true')
        .andWhere('LOWER(spot.city) = LOWER(:city)', { city })
        .andWhere('spot."entryLatitude" IS NOT NULL')
        .andWhere('spot."entryLongitude" IS NOT NULL')
        .andWhere('spot."exitLatitude" IS NOT NULL')
        .andWhere('spot."exitLongitude" IS NOT NULL')
        .andWhere(
          province ? 'LOWER(spot.province) = LOWER(:province)' : '1=1',
          province ? { province } : {},
        )
        .getRawMany<{
          id: string;
          name: string;
          city: string;
          province: string | null;
          latitude: number;
          longitude: number;
        }>(),
      this.shoppingRepository
        .createQueryBuilder('shopping')
        .select([
          'shopping.id AS id',
          'shopping.name AS name',
          'shopping.city AS city',
          'shopping.province AS province',
          'shopping.latitude AS latitude',
          'shopping.longitude AS longitude',
        ])
        .where('shopping."isPublished" = true')
        .andWhere('LOWER(shopping.city) = LOWER(:city)', { city })
        .andWhere('shopping.latitude IS NOT NULL')
        .andWhere('shopping.longitude IS NOT NULL')
        .andWhere(
          province ? 'LOWER(shopping.province) = LOWER(:province)' : '1=1',
          province ? { province } : {},
        )
        .getRawMany<{
          id: string;
          name: string;
          city: string;
          province: string | null;
          latitude: number;
          longitude: number;
        }>(),
      this.hotelRepository
        .createQueryBuilder('hotel')
        .select([
          'hotel.id AS id',
          'hotel.name AS name',
          'hotel.city AS city',
          'hotel.province AS province',
          'hotel.latitude AS latitude',
          'hotel.longitude AS longitude',
        ])
        .where('hotel."isPublished" = true')
        .andWhere('LOWER(hotel.city) = LOWER(:city)', { city })
        .andWhere('hotel.latitude IS NOT NULL')
        .andWhere('hotel.longitude IS NOT NULL')
        .andWhere(
          province ? 'LOWER(hotel.province) = LOWER(:province)' : '1=1',
          province ? { province } : {},
        )
        .getRawMany<{
          id: string;
          name: string;
          city: string;
          province: string | null;
          latitude: number;
          longitude: number;
        }>(),
    ]);

    return [
      ...spots.map((item) => ({
        ...item,
        pointType: 'spot' as const,
      })),
      ...shopping.map((item) => ({
        ...item,
        pointType: 'shopping' as const,
      })),
      ...hotels.map((item) => ({
        ...item,
        pointType: 'hotel' as const,
      })),
    ];
  }

  private async loadCityEdges(
    city: string,
    province: string | null,
    nodeIds: string[],
  ): Promise<MatrixEdgeRow[]> {
    if (nodeIds.length === 0) {
      return [];
    }

    const qb = this.transitCacheRepository
      .createQueryBuilder('cache')
      .select([
        'cache."fromPointId" AS "fromPointId"',
        'cache."toPointId" AS "toPointId"',
        'cache.status AS status',
        'cache."transitMinutes" AS "transitMinutes"',
        'cache."drivingMinutes" AS "drivingMinutes"',
        'cache."walkingMeters" AS "walkingMeters"',
        'cache."walkingMinutes" AS "walkingMinutes"',
        'cache."transitProviderStatus" AS "transitProviderStatus"',
        'cache."updatedAt" AS "updatedAt"',
      ])
      .where('LOWER(cache.city) = LOWER(:city)', { city })
      .andWhere('cache."fromPointId" IN (:...nodeIds)', { nodeIds })
      .andWhere('cache."toPointId" IN (:...nodeIds)', { nodeIds });

    if (province) {
      qb.andWhere('LOWER(cache.province) = LOWER(:province)', {
        province,
      });
    }

    return qb.getRawMany<MatrixEdgeRow>();
  }

  private async listCityRefs(): Promise<MatrixCityRef[]> {
    const [spots, shopping, hotels] = await Promise.all([
      this.spotRepository
        .createQueryBuilder('spot')
        .select(['spot.city AS city', 'spot.province AS province'])
        .where('spot."isPublished" = true')
        .andWhere('spot."entryLatitude" IS NOT NULL')
        .andWhere('spot."entryLongitude" IS NOT NULL')
        .andWhere('spot."exitLatitude" IS NOT NULL')
        .andWhere('spot."exitLongitude" IS NOT NULL')
        .groupBy('spot.city')
        .addGroupBy('spot.province')
        .getRawMany<MatrixCityRef>(),
      this.shoppingRepository
        .createQueryBuilder('shopping')
        .select(['shopping.city AS city', 'shopping.province AS province'])
        .where('shopping."isPublished" = true')
        .andWhere('shopping.latitude IS NOT NULL')
        .andWhere('shopping.longitude IS NOT NULL')
        .groupBy('shopping.city')
        .addGroupBy('shopping.province')
        .getRawMany<MatrixCityRef>(),
      this.hotelRepository
        .createQueryBuilder('hotel')
        .select(['hotel.city AS city', 'hotel.province AS province'])
        .where('hotel."isPublished" = true')
        .andWhere('hotel.latitude IS NOT NULL')
        .andWhere('hotel.longitude IS NOT NULL')
        .groupBy('hotel.city')
        .addGroupBy('hotel.province')
        .getRawMany<MatrixCityRef>(),
    ]);

    const merged = new Map<string, MatrixCityRef>();
    for (const item of [...spots, ...shopping, ...hotels]) {
      const city = item.city?.trim() || '';
      const province = item.province?.trim() || null;
      if (!city) {
        continue;
      }
      const key = `${city.toLowerCase()}\u0000${(province ?? '').toLowerCase()}`;
      if (!merged.has(key)) {
        merged.set(key, { city, province });
      }
    }

    return Array.from(merged.values()).sort((a, b) => {
      if ((a.province ?? '') !== (b.province ?? '')) {
        return (a.province ?? '').localeCompare(b.province ?? '');
      }
      return a.city.localeCompare(b.city);
    });
  }

  private matchCityRef(
    item: MatrixCityRef,
    query: ListMatrixCitiesQueryDto,
  ): boolean {
    const queryProvince = this.normalizeOptional(query.province);
    const queryCity = this.normalizeOptional(query.city);
    const keyword = this.normalizeOptional(query.q)?.toLowerCase() || null;

    if (
      queryProvince &&
      (item.province ?? '').toLowerCase() !== queryProvince.toLowerCase()
    ) {
      return false;
    }
    if (queryCity && item.city.toLowerCase() !== queryCity.toLowerCase()) {
      return false;
    }
    if (!keyword) {
      return true;
    }

    const searchText = `${item.city} ${item.province ?? ''}`.toLowerCase();
    return searchText.includes(keyword);
  }

  private async resolvePointById(pointId: string): Promise<MatrixNode> {
    const [spot, shopping, hotel] = await Promise.all([
      this.spotRepository.findOne({ where: { id: pointId } }),
      this.shoppingRepository.findOne({ where: { id: pointId } }),
      this.hotelRepository.findOne({ where: { id: pointId } }),
    ]);

    if (spot) {
      return {
        id: spot.id,
        pointType: 'spot',
        name: spot.name,
        city: spot.city,
        province: spot.province || null,
        cityI18n: spot.cityI18n,
        latitude: spot.entryLatitude as number,
        longitude: spot.entryLongitude as number,
        entryLatitude: spot.entryLatitude as number,
        entryLongitude: spot.entryLongitude as number,
        exitLatitude: spot.exitLatitude as number,
        exitLongitude: spot.exitLongitude as number,
      };
    }
    if (shopping) {
      return {
        id: shopping.id,
        pointType: 'shopping',
        name: shopping.name,
        city: shopping.city,
        province: shopping.province || null,
        cityI18n: shopping.cityI18n,
        latitude: shopping.latitude as number,
        longitude: shopping.longitude as number,
      };
    }
    if (hotel) {
      return {
        id: hotel.id,
        pointType: 'hotel',
        name: hotel.name,
        city: hotel.city,
        province: hotel.province || null,
        cityI18n: hotel.cityI18n,
        latitude: hotel.latitude as number,
        longitude: hotel.longitude as number,
      };
    }

    throw new NotFoundException({
      code: 'MATRIX_POINT_NOT_FOUND',
      message: 'Point not found.',
    });
  }

  private normalizeRequired(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException({
        code: 'MATRIX_FIELD_REQUIRED',
        message: `${field} is required.`,
      });
    }
    return normalized;
  }

  private normalizeOptional(value?: string | null): string | null {
    const normalized = value?.trim() || '';
    return normalized.length > 0 ? normalized : null;
  }

  private buildPointRecomputeMessage(
    summary: TransitPointNeighborhoodRecomputeSummary,
  ): string {
    if (!summary.transitEnabled) {
      return 'Point neighborhood recomputed, but AMAP transit is disabled.';
    }

    if (summary.totalEdges === 0) {
      return 'Point neighborhood recomputed, but there were no eligible edges.';
    }

    if (
      summary.transitReadyEdges === 0 &&
      summary.transitFallbackEdges > 0 &&
      summary.transitNoRouteEdges === 0
    ) {
      const candidateText =
        summary.transitCityCandidates.length > 0
          ? ` tried city=${summary.transitCityCandidates.join(' / ')}.`
          : '';
      return `Point neighborhood recomputed, but all transit edges still fell back.${candidateText}`;
    }

    return `Point neighborhood recomputed. transit ready ${summary.transitReadyEdges}/${summary.totalEdges}, fallback ${summary.transitFallbackEdges}/${summary.totalEdges}, no_route ${summary.transitNoRouteEdges}/${summary.totalEdges}.`;
  }

  private buildEdgeKey(fromPointId: string, toPointId: string): string {
    return `${fromPointId}->${toPointId}`;
  }

  private resolveCityStatus(input: {
    expectedDirected: number;
    readyDirected: number;
    staleDirected: number;
    failedDirected: number;
    modeCoverage: MatrixModeCoverageSummary;
  }): MatrixCityStatus {
    if (input.expectedDirected <= 0) {
      return 'pending';
    }
    const allEdgesReady = input.readyDirected === input.expectedDirected;
    const allModesReady =
      input.modeCoverage.drivingCoverage >= 1 &&
      input.modeCoverage.walkingCoverage >= 1 &&
      input.modeCoverage.walkingMinutesCoverage >= 1 &&
      input.modeCoverage.transitCoverage >= 1;

    if (allEdgesReady && allModesReady) {
      return 'ready';
    }
    if (input.readyDirected > 0) {
      return 'partial';
    }
    if (input.failedDirected > 0) {
      return 'failed';
    }
    if (input.staleDirected > 0) {
      return 'stale';
    }
    return 'pending';
  }

  private async buildCityDiagnostics(
    city: string,
    province: string | null,
  ): Promise<MatrixDiagnosticsSummary> {
    const [spots, shopping, hotels] = await Promise.all([
      this.loadPublishedSpots(city, province),
      this.loadPublishedShopping(city, province),
      this.loadPublishedHotels(city, province),
    ]);

    const anchorMissingSample: MatrixAnchorMissingItem[] = [];
    let anchorMissingCount = 0;
    const solverIssueMap = new Map<
      string,
      { count: number; samples: string[] }
    >();

    const pushAnchorMissing = (
      pointId: string,
      pointType: TransitCachePointType,
      name: string,
      missingAnchors: string[],
    ) => {
      if (missingAnchors.length === 0) {
        return;
      }
      anchorMissingCount += 1;
      if (anchorMissingSample.length < 50) {
        anchorMissingSample.push({
          pointId,
          pointType,
          name,
          missingAnchors,
        });
      }
    };

    const addIssue = (reason: string, sample: string) => {
      const current = solverIssueMap.get(reason) ?? { count: 0, samples: [] };
      current.count += 1;
      if (current.samples.length < 8 && !current.samples.includes(sample)) {
        current.samples.push(sample);
      }
      solverIssueMap.set(reason, current);
    };

    for (const spot of spots) {
      const missingAnchors: string[] = [];
      if (
        !this.hasFiniteCoordinatePair(spot.entryLatitude, spot.entryLongitude)
      ) {
        missingAnchors.push('entry');
        addIssue('spot_missing_entry_coordinate', spot.id);
      }
      if (
        !this.hasFiniteCoordinatePair(spot.exitLatitude, spot.exitLongitude)
      ) {
        missingAnchors.push('exit');
        addIssue('spot_missing_exit_coordinate', spot.id);
      }
      pushAnchorMissing(spot.id, 'spot', spot.name, missingAnchors);

      if (
        !Array.isArray(spot.openingHoursJson) ||
        spot.openingHoursJson.length === 0
      ) {
        addIssue('spot_missing_opening_hours', spot.id);
      }
      if (!spot.lastEntryTime?.trim()) {
        addIssue('spot_missing_last_entry_time', spot.id);
      }
    }

    for (const item of shopping) {
      if (!this.hasFiniteCoordinatePair(item.latitude, item.longitude)) {
        addIssue('shopping_missing_route_coordinate', item.id);
      }
      if (
        !Array.isArray(item.openingHoursJson) ||
        item.openingHoursJson.length === 0
      ) {
        addIssue('shopping_missing_opening_hours', item.id);
      }
    }

    for (const item of hotels) {
      if (!this.hasFiniteCoordinatePair(item.latitude, item.longitude)) {
        addIssue('hotel_missing_route_coordinate', item.id);
      }
    }

    const solverIssueSummary = Array.from(solverIssueMap.entries())
      .map(([reason, value]) => ({
        reason,
        count: value.count,
        samples: value.samples,
      }))
      .sort((a, b) => {
        if (a.count !== b.count) {
          return b.count - a.count;
        }
        return a.reason.localeCompare(b.reason);
      });

    return {
      anchorMissingCount,
      anchorMissingSample,
      solverIssueSummary,
    };
  }

  private async loadPublishedSpots(
    city: string,
    province: string | null,
  ): Promise<Spot[]> {
    const qb = this.spotRepository
      .createQueryBuilder('spot')
      .where('spot."isPublished" = true')
      .andWhere('LOWER(spot.city) = LOWER(:city)', { city });
    if (province) {
      qb.andWhere('LOWER(spot.province) = LOWER(:province)', { province });
    }
    return qb.getMany();
  }

  private async loadPublishedShopping(
    city: string,
    province: string | null,
  ): Promise<ShoppingPlace[]> {
    const qb = this.shoppingRepository
      .createQueryBuilder('shopping')
      .where('shopping."isPublished" = true')
      .andWhere('LOWER(shopping.city) = LOWER(:city)', { city });
    if (province) {
      qb.andWhere('LOWER(shopping.province) = LOWER(:province)', { province });
    }
    return qb.getMany();
  }

  private async loadPublishedHotels(
    city: string,
    province: string | null,
  ): Promise<HotelPlace[]> {
    const qb = this.hotelRepository
      .createQueryBuilder('hotel')
      .where('hotel."isPublished" = true')
      .andWhere('LOWER(hotel.city) = LOWER(:city)', { city });
    if (province) {
      qb.andWhere('LOWER(hotel.province) = LOWER(:province)', { province });
    }
    return qb.getMany();
  }

  private hasFiniteCoordinatePair(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ): boolean {
    return Number.isFinite(latitude) && Number.isFinite(longitude);
  }

  private toCoverage(expected: number, ready: number): number {
    if (expected <= 0) {
      return 1;
    }
    const value = ready / expected;
    return Number(Math.max(0, Math.min(1, value)).toFixed(4));
  }
}
