import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
} from '../transit-cache/entities/transit-cache.entity';
import { TransitCachePrecomputeService } from '../transit-cache/transit-cache-precompute.service';
import { GetCityMatrixStatusQueryDto } from './dto/get-city-matrix-status-query.dto';
import { ListMatrixCitiesQueryDto } from './dto/list-matrix-cities-query.dto';
import { RecomputeCityMatrixDto } from './dto/recompute-city-matrix.dto';
import { RecomputePointMatrixDto } from './dto/recompute-point-matrix.dto';

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
  drivingMinutes: number;
  walkingMeters: number;
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
  restaurant: number;
  hotel: number;
  airport: number;
}

export interface MatrixModeCoverageSummary {
  readyEdgeCount: number;
  drivingMinutesPresent: number;
  walkingMetersPresent: number;
  hasDriving: boolean;
  hasWalking: boolean;
  drivingCoverage: number;
  walkingCoverage: number;
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
  canGenerate: boolean;
  lastUpdatedAt: string | null;
}

export interface MatrixCityStatusItem extends MatrixCityStatusBase {
  nodes: MatrixCityNodeItem[];
  missingEdgesSample: MatrixMissingEdgeItem[];
}

export interface MatrixCityListItem extends MatrixCityStatusBase {}

@Injectable()
export class MatrixAdminService {
  constructor(
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
    @InjectRepository(TransitCache)
    private readonly transitCacheRepository: Repository<TransitCache>,
    private readonly transitCachePrecomputeService: TransitCachePrecomputeService,
  ) {}

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

  recomputeCity(dto: RecomputeCityMatrixDto): {
    accepted: true;
    city: string;
    province: string | null;
    message: string;
  } {
    const city = this.normalizeRequired(dto.city, 'city');
    const province = this.normalizeOptional(dto.province);

    this.transitCachePrecomputeService.scheduleRecomputeCity(city, province);

    return {
      accepted: true,
      city,
      province,
      message: 'Matrix recompute scheduled.',
    };
  }

  async recomputePoint(dto: RecomputePointMatrixDto): Promise<{
    accepted: true;
    pointId: string;
    pointType: TransitCachePointType;
    city: string;
    province: string | null;
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
      point.pointType === 'spot'
        ? !hasSpotEntryExitCoordinate
        : !hasCenterCoordinate;

    if (coordinateInvalid) {
      throw new BadRequestException({
        code: 'MATRIX_POINT_COORDINATE_REQUIRED',
        message: 'Point coordinates are required for recompute.',
      });
    }

    this.transitCachePrecomputeService.scheduleRecomputePointNeighborhood({
      id: point.id,
      pointType: point.pointType,
      city: point.city,
      province: point.province,
      latitude: point.latitude,
      longitude: point.longitude,
      entryLatitude: point.entryLatitude,
      entryLongitude: point.entryLongitude,
      exitLatitude: point.exitLatitude,
      exitLongitude: point.exitLongitude,
    });

    return {
      accepted: true,
      pointId: point.id,
      pointType: point.pointType,
      city: point.city,
      province: point.province,
      message: 'Point neighborhood recompute scheduled.',
    };
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
      restaurant: nodes.filter((item) => item.pointType === 'restaurant').length,
      hotel: nodes.filter((item) => item.pointType === 'hotel').length,
      airport: nodes.filter((item) => item.pointType === 'airport').length,
    };

    const expectedDirected =
      uniqueNodeIds.length <= 1 ? 0 : uniqueNodeIds.length * (uniqueNodeIds.length - 1);

    let readyDirected = 0;
    let staleDirected = 0;
    let failedDirected = 0;
    const readyDirectedSet = new Set<string>();
    const outReadyByNode = new Map<string, number>();
    const inReadyByNode = new Map<string, number>();

    let drivingMinutesPresent = 0;
    let walkingMetersPresent = 0;
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
            if (edge.walkingMeters > 0) {
              walkingMetersPresent += 1;
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

    const expectedUndirected = uniqueNodeIds.length <= 1 ? 0 : (uniqueNodeIds.length * (uniqueNodeIds.length - 1)) / 2;

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
      ? this.buildNodeDetails(uniqueNodeIds, nodeById, outReadyByNode, inReadyByNode)
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

    return {
      city,
      province,
      nodeCount,
      status: this.resolveCityStatus({
        expectedDirected,
        readyDirected,
        staleDirected,
        failedDirected,
      }),
      directed,
      undirected,
      modeCoverage: {
        readyEdgeCount: readyDirected,
        drivingMinutesPresent,
        walkingMetersPresent,
        hasDriving: drivingMinutesPresent > 0,
        hasWalking: walkingMetersPresent > 0,
        drivingCoverage: this.toCoverage(readyDirected, drivingMinutesPresent),
        walkingCoverage: this.toCoverage(readyDirected, walkingMetersPresent),
      },
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
      const expectedTotal = peerCount * 2;
      const readyTotal = outReadyEdges + inReadyEdges;

      let status: MatrixNodeStatus = 'pending';
      if (expectedTotal > 0 && readyTotal === expectedTotal) {
        status = 'ready';
      } else if (readyTotal > 0) {
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
    const [spots, shopping, restaurants, hotels, airports] = await Promise.all([
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
          province
            ? 'LOWER(spot.province) = LOWER(:province)'
            : '1=1',
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
          province
            ? 'LOWER(shopping.province) = LOWER(:province)'
            : '1=1',
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
      this.restaurantRepository
        .createQueryBuilder('restaurant')
        .select([
          'restaurant.id AS id',
          'restaurant.name AS name',
          'restaurant.city AS city',
          'restaurant.province AS province',
          'restaurant.latitude AS latitude',
          'restaurant.longitude AS longitude',
        ])
        .where('restaurant."isPublished" = true')
        .andWhere('LOWER(restaurant.city) = LOWER(:city)', { city })
        .andWhere('restaurant.latitude IS NOT NULL')
        .andWhere('restaurant.longitude IS NOT NULL')
        .andWhere(
          province
            ? 'LOWER(restaurant.province) = LOWER(:province)'
            : '1=1',
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
          province
            ? 'LOWER(hotel.province) = LOWER(:province)'
            : '1=1',
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
      this.airportRepository
        .createQueryBuilder('airport')
        .leftJoin('airport.city', 'city')
        .leftJoin('city.province', 'province')
        .select([
          'airport.id AS id',
          'airport.name AS name',
          'city.name AS city',
          'province.name AS province',
          'airport.latitude AS latitude',
          'airport.longitude AS longitude',
        ])
        .where('airport.latitude IS NOT NULL')
        .andWhere('airport.longitude IS NOT NULL')
        .andWhere('LOWER(city.name) = LOWER(:city)', { city })
        .andWhere(
          province
            ? 'LOWER(province.name) = LOWER(:province)'
            : '1=1',
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
      ...restaurants.map((item) => ({
        ...item,
        pointType: 'restaurant' as const,
      })),
      ...hotels.map((item) => ({
        ...item,
        pointType: 'hotel' as const,
      })),
      ...airports.map((item) => ({
        ...item,
        pointType: 'airport' as const,
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
        'cache."drivingMinutes" AS "drivingMinutes"',
        'cache."walkingMeters" AS "walkingMeters"',
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
    const [spots, shopping, restaurants, hotels, airports] = await Promise.all([
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
      this.restaurantRepository
        .createQueryBuilder('restaurant')
        .select(['restaurant.city AS city', 'restaurant.province AS province'])
        .where('restaurant."isPublished" = true')
        .andWhere('restaurant.latitude IS NOT NULL')
        .andWhere('restaurant.longitude IS NOT NULL')
        .groupBy('restaurant.city')
        .addGroupBy('restaurant.province')
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
      this.airportRepository
        .createQueryBuilder('airport')
        .leftJoin('airport.city', 'city')
        .leftJoin('city.province', 'province')
        .select(['city.name AS city', 'province.name AS province'])
        .where('airport.latitude IS NOT NULL')
        .andWhere('airport.longitude IS NOT NULL')
        .groupBy('city.name')
        .addGroupBy('province.name')
        .getRawMany<MatrixCityRef>(),
    ]);

    const merged = new Map<string, MatrixCityRef>();
    for (const item of [
      ...spots,
      ...shopping,
      ...restaurants,
      ...hotels,
      ...airports,
    ]) {
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

  private matchCityRef(item: MatrixCityRef, query: ListMatrixCitiesQueryDto): boolean {
    const queryProvince = this.normalizeOptional(query.province);
    const queryCity = this.normalizeOptional(query.city);
    const keyword = this.normalizeOptional(query.q)?.toLowerCase() || null;

    if (queryProvince && (item.province ?? '').toLowerCase() !== queryProvince.toLowerCase()) {
      return false;
    }
    if (queryCity && item.city.toLowerCase() !== queryCity.toLowerCase()) {
      return false;
    }
    if (!keyword) {
      return true;
    }

    const searchText = `${item.city} ${(item.province ?? '')}`.toLowerCase();
    return searchText.includes(keyword);
  }

  private async resolvePointById(pointId: string): Promise<MatrixNode> {
    const [spot, shopping, restaurant, hotel, airport] = await Promise.all([
      this.spotRepository.findOne({ where: { id: pointId } }),
      this.shoppingRepository.findOne({ where: { id: pointId } }),
      this.restaurantRepository.findOne({ where: { id: pointId } }),
      this.hotelRepository.findOne({ where: { id: pointId } }),
      this.airportRepository
        .createQueryBuilder('airport')
        .leftJoinAndSelect('airport.city', 'city')
        .leftJoinAndSelect('city.province', 'province')
        .where('airport.id = :pointId', { pointId })
        .getOne(),
    ]);

    if (spot) {
      return {
        id: spot.id,
        pointType: 'spot',
        name: spot.name,
        city: spot.city,
        province: spot.province || null,
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
        latitude: shopping.latitude as number,
        longitude: shopping.longitude as number,
      };
    }
    if (restaurant) {
      return {
        id: restaurant.id,
        pointType: 'restaurant',
        name: restaurant.name,
        city: restaurant.city,
        province: restaurant.province || null,
        latitude: restaurant.latitude as number,
        longitude: restaurant.longitude as number,
      };
    }
    if (hotel) {
      return {
        id: hotel.id,
        pointType: 'hotel',
        name: hotel.name,
        city: hotel.city,
        province: hotel.province || null,
        latitude: hotel.latitude as number,
        longitude: hotel.longitude as number,
      };
    }
    if (airport && airport.city) {
      return {
        id: airport.id,
        pointType: 'airport',
        name: airport.name,
        city: airport.city.name,
        province: airport.city.province?.name || null,
        latitude: airport.latitude as number,
        longitude: airport.longitude as number,
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

  private buildEdgeKey(fromPointId: string, toPointId: string): string {
    return `${fromPointId}->${toPointId}`;
  }

  private resolveCityStatus(input: {
    expectedDirected: number;
    readyDirected: number;
    staleDirected: number;
    failedDirected: number;
  }): MatrixCityStatus {
    if (input.expectedDirected <= 0) {
      return 'pending';
    }
    if (input.readyDirected === input.expectedDirected) {
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

  private toCoverage(expected: number, ready: number): number {
    if (expected <= 0) {
      return 1;
    }
    const value = ready / expected;
    return Number(Math.max(0, Math.min(1, value)).toFixed(4));
  }
}
