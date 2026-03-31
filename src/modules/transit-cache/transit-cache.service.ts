import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelPlace } from '../hotels/entities/hotel.entity';
import { LocationAirport } from '../locations/entities/location-airport.entity';
import { RestaurantPlace } from '../restaurants/entities/restaurant.entity';
import { ShoppingPlace } from '../shopping/entities/shopping.entity';
import { Spot } from '../spots/entities/spot.entity';
import {
  TransitCache,
  TransitCachePointType,
  TransitCacheStatus,
} from './entities/transit-cache.entity';

export interface UpsertTransitEdgeInput {
  city: string;
  province?: string | null;
  fromPointId: string;
  fromPointType: TransitCachePointType;
  toPointId: string;
  toPointType: TransitCachePointType;
  transitMinutes: number;
  drivingMinutes: number;
  walkingMeters: number;
  transitSummary?: string | null;
  transitSummaryI18n?: Record<string, string> | null;
  distanceKm: number;
  provider?: string;
  status?: TransitCacheStatus;
  expiresAt?: Date | null;
}

export type PointMatrixStatus = 'ready' | 'partial' | 'stale' | 'failed' | 'pending';

export interface PointMatrixStatusSummary {
  pointId: string;
  status: PointMatrixStatus;
  totalEdges: number;
  readyEdges: number;
  staleEdges: number;
  failedEdges: number;
}

@Injectable()
export class TransitCacheService {
  private readonly logger = new Logger(TransitCacheService.name);

  constructor(
    @InjectRepository(TransitCache)
    private readonly transitCacheRepository: Repository<TransitCache>,
    @InjectRepository(Spot)
    private readonly spotRepository: Repository<Spot>,
    @InjectRepository(ShoppingPlace)
    private readonly shoppingRepository: Repository<ShoppingPlace>,
    @InjectRepository(RestaurantPlace)
    private readonly restaurantRepository: Repository<RestaurantPlace>,
    @InjectRepository(HotelPlace)
    private readonly hotelRepository: Repository<HotelPlace>,
    @InjectRepository(LocationAirport)
    private readonly airportRepository: Repository<LocationAirport>,
  ) {}

  async markCityStale(city: string, province?: string | null): Promise<void> {
    const normalizedCity = city.trim();
    if (!normalizedCity) {
      return;
    }

    try {
      const qb = this.transitCacheRepository
        .createQueryBuilder()
        .update(TransitCache)
        .set({
          status: 'stale',
          expiresAt: new Date(),
        })
        .where('LOWER("city") = LOWER(:city)', { city: normalizedCity });

      const normalizedProvince = province?.trim() || null;
      if (normalizedProvince) {
        qb.andWhere('LOWER("province") = LOWER(:province)', {
          province: normalizedProvince,
        });
      }

      await qb.execute();
    } catch (error) {
      this.logger.warn(
        `Failed to mark transit cache stale by city=${normalizedCity}: ${(error as Error).message}`,
      );
    }
  }

  async deletePointEdges(pointId: string): Promise<void> {
    const normalizedPointId = pointId.trim();
    if (!normalizedPointId) {
      return;
    }

    try {
      await this.transitCacheRepository
        .createQueryBuilder()
        .delete()
        .from(TransitCache)
        .where('"fromPointId" = :pointId', { pointId: normalizedPointId })
        .orWhere('"toPointId" = :pointId', { pointId: normalizedPointId })
        .execute();
    } catch (error) {
      this.logger.warn(
        `Failed to delete transit cache edges by pointId=${normalizedPointId}: ${(error as Error).message}`,
      );
    }
  }

  async deletePointEdgesByIds(pointIds: string[]): Promise<void> {
    const uniquePointIds = Array.from(
      new Set(
        pointIds
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    );
    if (uniquePointIds.length === 0) {
      return;
    }

    try {
      await this.transitCacheRepository
        .createQueryBuilder()
        .delete()
        .from(TransitCache)
        .where('"fromPointId" IN (:...pointIds)', { pointIds: uniquePointIds })
        .orWhere('"toPointId" IN (:...pointIds)', { pointIds: uniquePointIds })
        .execute();
    } catch (error) {
      this.logger.warn(
        `Failed to delete transit cache edges by pointIds count=${uniquePointIds.length}: ${(error as Error).message}`,
      );
    }
  }

  async upsertEdge(input: UpsertTransitEdgeInput): Promise<void> {
    try {
      await this.transitCacheRepository.upsert(
        {
          city: input.city.trim(),
          province: input.province?.trim() || null,
          fromPointId: input.fromPointId,
          fromPointType: input.fromPointType,
          toPointId: input.toPointId,
          toPointType: input.toPointType,
          transitMinutes: input.transitMinutes,
          drivingMinutes: input.drivingMinutes,
          walkingMeters: input.walkingMeters,
          transitSummary: input.transitSummary?.trim() || null,
          transitSummaryI18n: input.transitSummaryI18n ?? null,
          distanceKm: input.distanceKm,
          provider: input.provider?.trim() || 'amap',
          status: input.status ?? 'ready',
          expiresAt: input.expiresAt ?? null,
        },
        ['city', 'fromPointId', 'toPointId'],
      );
    } catch (error) {
      this.logger.warn(
        `Failed to upsert transit cache edge ${input.fromPointId} -> ${input.toPointId}: ${(error as Error).message}`,
      );
    }
  }

  async findReadyEdgesByCityAndPointIds(
    city: string,
    pointIds: string[],
  ): Promise<TransitCache[]> {
    const normalizedCity = city.trim();
    const uniquePointIds = Array.from(
      new Set(pointIds.map((item) => item.trim()).filter((item) => item.length > 0)),
    );

    if (!normalizedCity || uniquePointIds.length === 0) {
      return [];
    }

    return this.transitCacheRepository
      .createQueryBuilder('cache')
      .where('LOWER(cache.city) = LOWER(:city)', { city: normalizedCity })
      .andWhere('cache.status = :status', { status: 'ready' })
      .andWhere('cache."fromPointId" IN (:...pointIds)', {
        pointIds: uniquePointIds,
      })
      .andWhere('cache."toPointId" IN (:...pointIds)', {
        pointIds: uniquePointIds,
      })
      .getMany();
  }

  async getPointMatrixStatuses(
    pointIds: string[],
  ): Promise<Record<string, PointMatrixStatusSummary>> {
    const uniquePointIds = Array.from(
      new Set(
        pointIds
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    );

    const summaryMap: Record<string, PointMatrixStatusSummary> = {};
    for (const pointId of uniquePointIds) {
      summaryMap[pointId] = {
        pointId,
        status: 'pending',
        totalEdges: 0,
        readyEdges: 0,
        staleEdges: 0,
        failedEdges: 0,
      };
    }

    if (uniquePointIds.length === 0) {
      return summaryMap;
    }

    const rows = await this.transitCacheRepository
      .createQueryBuilder('cache')
      .select([
        'cache."fromPointId" AS "fromPointId"',
        'cache."toPointId" AS "toPointId"',
        'cache.status AS "status"',
      ])
      .where('cache."fromPointId" IN (:...pointIds)', {
        pointIds: uniquePointIds,
      })
      .orWhere('cache."toPointId" IN (:...pointIds)', {
        pointIds: uniquePointIds,
      })
      .getRawMany<{
        fromPointId: string;
        toPointId: string;
        status: TransitCacheStatus;
      }>();

    const existingPointIdSet = await this.getExistingPointIdSet(
      Array.from(
        new Set(
          rows.flatMap((row) => [row.fromPointId, row.toPointId]),
        ),
      ),
    );

    for (const row of rows) {
      if (
        !existingPointIdSet.has(row.fromPointId) ||
        !existingPointIdSet.has(row.toPointId)
      ) {
        continue;
      }

      const relatedPointIds: string[] = [];
      if (summaryMap[row.fromPointId]) {
        relatedPointIds.push(row.fromPointId);
      }
      if (
        row.toPointId !== row.fromPointId &&
        summaryMap[row.toPointId]
      ) {
        relatedPointIds.push(row.toPointId);
      }

      for (const pointId of relatedPointIds) {
        const summary = summaryMap[pointId];
        summary.totalEdges += 1;
        if (row.status === 'ready') {
          summary.readyEdges += 1;
        } else if (row.status === 'stale') {
          summary.staleEdges += 1;
        } else if (row.status === 'failed') {
          summary.failedEdges += 1;
        }
      }
    }

    for (const summary of Object.values(summaryMap)) {
      summary.status = this.resolvePointMatrixStatus(summary);
    }

    return summaryMap;
  }

  private async getExistingPointIdSet(
    pointIds: string[],
  ): Promise<Set<string>> {
    if (pointIds.length === 0) {
      return new Set<string>();
    }

    const [spots, shopping, restaurants, hotels, airports] = await Promise.all([
      this.spotRepository
        .createQueryBuilder('spot')
        .select('spot.id', 'id')
        .where('spot.id IN (:...pointIds)', { pointIds })
        .getRawMany<{ id: string }>(),
      this.shoppingRepository
        .createQueryBuilder('shopping')
        .select('shopping.id', 'id')
        .where('shopping.id IN (:...pointIds)', { pointIds })
        .getRawMany<{ id: string }>(),
      this.restaurantRepository
        .createQueryBuilder('restaurant')
        .select('restaurant.id', 'id')
        .where('restaurant.id IN (:...pointIds)', { pointIds })
        .getRawMany<{ id: string }>(),
      this.hotelRepository
        .createQueryBuilder('hotel')
        .select('hotel.id', 'id')
        .where('hotel.id IN (:...pointIds)', { pointIds })
        .getRawMany<{ id: string }>(),
      this.airportRepository
        .createQueryBuilder('airport')
        .select('airport.id', 'id')
        .where('airport.id IN (:...pointIds)', { pointIds })
        .getRawMany<{ id: string }>(),
    ]);

    return new Set<string>([
      ...spots.map((item) => item.id),
      ...shopping.map((item) => item.id),
      ...restaurants.map((item) => item.id),
      ...hotels.map((item) => item.id),
      ...airports.map((item) => item.id),
    ]);
  }

  private resolvePointMatrixStatus(
    summary: Omit<PointMatrixStatusSummary, 'status'>,
  ): PointMatrixStatus {
    if (summary.totalEdges === 0) {
      return 'pending';
    }
    if (summary.readyEdges === summary.totalEdges) {
      return 'ready';
    }
    if (summary.readyEdges > 0) {
      return 'partial';
    }
    if (summary.failedEdges > 0) {
      return 'failed';
    }
    if (summary.staleEdges > 0) {
      return 'stale';
    }
    return 'pending';
  }
}
