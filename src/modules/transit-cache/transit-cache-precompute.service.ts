import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelPlace } from '../hotels/entities/hotel.entity';
import { LocationAirport } from '../locations/entities/location-airport.entity';
import { RestaurantPlace } from '../restaurants/entities/restaurant.entity';
import { ShoppingPlace } from '../shopping/entities/shopping.entity';
import { Spot } from '../spots/entities/spot.entity';
import {
  AmapCoordinate,
  AmapDirectionResult,
  AmapMatrixItem,
  AmapTransitClient,
} from './amap/amap-transit.client';
import {
  TransitCache,
  TransitCachePointType,
  TransitProviderStatus,
} from './entities/transit-cache.entity';
import { TransitCacheService } from './transit-cache.service';

interface TransitPoint {
  id: string;
  pointType: TransitCachePointType;
  city: string;
  province: string | null;
  cityI18n?: Record<string, string | undefined> | null;
  transitCityCandidates: string[];
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
}

export interface TransitPointNeighborhoodRecomputeSummary {
  pointId: string;
  pointType: TransitCachePointType;
  city: string;
  province: string | null;
  totalEdges: number;
  transitReadyEdges: number;
  transitFallbackEdges: number;
  transitCityCandidates: string[];
  transitEnabled: boolean;
  drivingReadyEdges: number;
  walkingReadyEdges: number;
  walkingMinutesReadyEdges: number;
}

export type TransitPrecomputeMode = 'transit' | 'driving' | 'walking';

interface TransitPrecomputeChunkSummary {
  totalEdges: number;
  transitReadyEdges: number;
  transitFallbackEdges: number;
  drivingReadyEdges: number;
  walkingReadyEdges: number;
  walkingMinutesReadyEdges: number;
}

interface TransitPrecomputeOptions {
  modes?: TransitPrecomputeMode[];
  onChunkProgress?: (
    summary: TransitPrecomputeChunkSummary,
  ) => Promise<void> | void;
}

export interface TransitPointRecomputeInput {
  id: string;
  pointType: TransitCachePointType;
  city: string;
  province?: string | null;
  cityI18n?: Record<string, string | undefined> | null;
  latitude?: number;
  longitude?: number;
  entryLatitude?: number;
  entryLongitude?: number;
  exitLatitude?: number;
  exitLongitude?: number;
  arrivalAnchorLatitude?: number;
  arrivalAnchorLongitude?: number;
  departureAnchorLatitude?: number;
  departureAnchorLongitude?: number;
}

@Injectable()
export class TransitCachePrecomputeService {
  private readonly logger = new Logger(TransitCachePrecomputeService.name);
  private static readonly MATRIX_REQUEST_RETRIES = 2;

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
    private readonly transitCacheService: TransitCacheService,
    private readonly amapTransitClient: AmapTransitClient,
  ) {}

  scheduleRecomputeCity(city: string, province?: string | null): void {
    void this.recomputeCity(city, province).catch((error: unknown) => {
      this.logger.warn(
        `Transit precompute failed city=${city} province=${province ?? ''}: ${(error as Error).message}`,
      );
    });
  }

  scheduleRecomputePointNeighborhood(
    point: TransitPointRecomputeInput,
  ): void {
    void this.recomputePointNeighborhood(point).catch((error: unknown) => {
      this.logger.warn(
        `Transit neighborhood precompute failed pointId=${point.id} city=${point.city}: ${(error as Error).message}`,
      );
    });
  }

  async recomputeCity(
    city: string,
    province?: string | null,
    options: TransitPrecomputeOptions = {},
  ): Promise<void> {
    const normalizedCity = city.trim();
    if (!normalizedCity) {
      return;
    }

    if (!this.amapTransitClient.isEnabled()) {
      this.logger.debug(
        `Skip transit precompute because AMAP is disabled city=${normalizedCity}`,
      );
      return;
    }

    const points = await this.loadCityPoints(normalizedCity, province);
    if (points.length < 2) {
      return;
    }

    const existingEdgeMap = await this.loadExistingEdgeMap(
      normalizedCity,
      province,
      points.map((item) => item.id),
    );

    for (const destination of points) {
      const origins = points.filter((item) => item.id !== destination.id);
      try {
        await this.recomputeEdgesToDestination(origins, destination, {
          modes: options.modes,
          existingEdgeMap,
          onChunkProgress: options.onChunkProgress,
        });
      } catch (error) {
        this.logger.warn(
          `Transit precompute destination failed city=${normalizedCity} destination=${destination.id}: ${(error as Error).message}`,
        );
      }
    }
  }

  async recomputePointNeighborhood(
    point: TransitPointRecomputeInput,
    options: TransitPrecomputeOptions = {},
  ): Promise<TransitPointNeighborhoodRecomputeSummary> {
    const normalizedPoint = this.normalizePointInput(point);
    if (!normalizedPoint) {
      return {
        pointId: point.id,
        pointType: point.pointType,
        city: point.city.trim(),
        province: point.province?.trim() || null,
        totalEdges: 0,
        transitReadyEdges: 0,
        transitFallbackEdges: 0,
        transitCityCandidates: this.resolveTransitCityCandidates(
          point.city,
          point.cityI18n,
        ),
        transitEnabled: this.amapTransitClient.isEnabled(),
        drivingReadyEdges: 0,
        walkingReadyEdges: 0,
        walkingMinutesReadyEdges: 0,
      };
    }

    if (!this.amapTransitClient.isEnabled()) {
      this.logger.debug(
        `Skip transit neighborhood precompute because AMAP is disabled city=${normalizedPoint.city}`,
      );
      return {
        pointId: normalizedPoint.id,
        pointType: normalizedPoint.pointType,
        city: normalizedPoint.city,
        province: normalizedPoint.province,
        totalEdges: 0,
        transitReadyEdges: 0,
        transitFallbackEdges: 0,
        transitCityCandidates: normalizedPoint.transitCityCandidates,
        transitEnabled: false,
        drivingReadyEdges: 0,
        walkingReadyEdges: 0,
        walkingMinutesReadyEdges: 0,
      };
    }

    const points = await this.loadCityPoints(
      normalizedPoint.city,
      normalizedPoint.province,
    );
    const others = points.filter((item) => !this.isSamePoint(item, normalizedPoint));
    if (others.length === 0) {
      return {
        pointId: normalizedPoint.id,
        pointType: normalizedPoint.pointType,
        city: normalizedPoint.city,
        province: normalizedPoint.province,
        totalEdges: 0,
        transitReadyEdges: 0,
        transitFallbackEdges: 0,
        transitCityCandidates: normalizedPoint.transitCityCandidates,
        transitEnabled: true,
        drivingReadyEdges: 0,
        walkingReadyEdges: 0,
        walkingMinutesReadyEdges: 0,
      };
    }

    const allPointIds = [normalizedPoint.id, ...others.map((item) => item.id)];
    const existingEdgeMap = await this.loadExistingEdgeMap(
      normalizedPoint.city,
      normalizedPoint.province,
      allPointIds,
    );

    const summary: TransitPointNeighborhoodRecomputeSummary = {
      pointId: normalizedPoint.id,
      pointType: normalizedPoint.pointType,
      city: normalizedPoint.city,
      province: normalizedPoint.province,
      totalEdges: 0,
      transitReadyEdges: 0,
      transitFallbackEdges: 0,
      transitCityCandidates: normalizedPoint.transitCityCandidates,
      transitEnabled: true,
      drivingReadyEdges: 0,
      walkingReadyEdges: 0,
      walkingMinutesReadyEdges: 0,
    };

    const inboundSummary = await this.recomputeEdgesToDestination(
      others,
      normalizedPoint,
      {
        modes: options.modes,
        existingEdgeMap,
        onChunkProgress: options.onChunkProgress,
      },
    );
    summary.totalEdges += inboundSummary.totalEdges;
    summary.transitReadyEdges += inboundSummary.transitReadyEdges;
    summary.transitFallbackEdges += inboundSummary.transitFallbackEdges;
    summary.drivingReadyEdges += inboundSummary.drivingReadyEdges;
    summary.walkingReadyEdges += inboundSummary.walkingReadyEdges;
    summary.walkingMinutesReadyEdges += inboundSummary.walkingMinutesReadyEdges;

    const concurrency = 2;
    for (let i = 0; i < others.length; i += concurrency) {
      const destinations = others.slice(i, i + concurrency);
      const chunkSummaries = await Promise.all(
        destinations.map((destination) =>
          this.recomputeEdgesToDestination(
            [normalizedPoint],
            destination,
            {
              modes: options.modes,
              existingEdgeMap,
              onChunkProgress: options.onChunkProgress,
            },
          ),
        ),
      );
      for (const chunkSummary of chunkSummaries) {
        summary.totalEdges += chunkSummary.totalEdges;
        summary.transitReadyEdges += chunkSummary.transitReadyEdges;
        summary.transitFallbackEdges += chunkSummary.transitFallbackEdges;
        summary.drivingReadyEdges += chunkSummary.drivingReadyEdges;
        summary.walkingReadyEdges += chunkSummary.walkingReadyEdges;
        summary.walkingMinutesReadyEdges += chunkSummary.walkingMinutesReadyEdges;
      }
    }

    return summary;
  }

  private async loadCityPoints(
    city: string,
    province?: string | null,
  ): Promise<TransitPoint[]> {
    const normalizedProvince = province?.trim() || null;

    const [spots, shopping, restaurants, hotels, airports] = await Promise.all([
      this.spotRepository
        .createQueryBuilder('spot')
        .where('spot."isPublished" = true')
        .andWhere('LOWER(spot.city) = LOWER(:city)', { city })
        .andWhere('spot."entryLatitude" IS NOT NULL')
        .andWhere('spot."entryLongitude" IS NOT NULL')
        .andWhere('spot."exitLatitude" IS NOT NULL')
        .andWhere('spot."exitLongitude" IS NOT NULL')
        .andWhere(
          normalizedProvince
            ? 'LOWER(spot.province) = LOWER(:province)'
            : '1=1',
          normalizedProvince ? { province: normalizedProvince } : {},
        )
        .getMany(),
      this.shoppingRepository
        .createQueryBuilder('shopping')
        .where('shopping."isPublished" = true')
        .andWhere('LOWER(shopping.city) = LOWER(:city)', { city })
        .andWhere(
          normalizedProvince
            ? 'LOWER(shopping.province) = LOWER(:province)'
            : '1=1',
          normalizedProvince ? { province: normalizedProvince } : {},
        )
        .getMany(),
      this.restaurantRepository
        .createQueryBuilder('restaurant')
        .where('restaurant."isPublished" = true')
        .andWhere('LOWER(restaurant.city) = LOWER(:city)', { city })
        .andWhere(
          normalizedProvince
            ? 'LOWER(restaurant.province) = LOWER(:province)'
            : '1=1',
          normalizedProvince ? { province: normalizedProvince } : {},
        )
        .getMany(),
      this.hotelRepository
        .createQueryBuilder('hotel')
        .where('hotel."isPublished" = true')
        .andWhere('LOWER(hotel.city) = LOWER(:city)', { city })
        .andWhere(
          normalizedProvince
            ? 'LOWER(hotel.province) = LOWER(:province)'
            : '1=1',
          normalizedProvince ? { province: normalizedProvince } : {},
        )
        .getMany(),
      this.airportRepository
        .createQueryBuilder('airport')
        .leftJoinAndSelect('airport.city', 'city')
        .leftJoinAndSelect('city.province', 'province')
        .where('1=1')
        .andWhere('LOWER(city.name) = LOWER(:city)', { city })
        .andWhere(
          normalizedProvince
            ? 'LOWER(province.name) = LOWER(:province)'
            : '1=1',
          normalizedProvince ? { province: normalizedProvince } : {},
        )
        .getMany(),
    ]);

    const spotPoints: TransitPoint[] = spots.map((item) => ({
      id: item.id,
      pointType: 'spot',
      city: item.city,
      province: item.province,
      cityI18n: item.cityI18n,
      transitCityCandidates: this.resolveTransitCityCandidates(
        item.city,
        item.cityI18n,
      ),
      originLatitude: item.exitLatitude as number,
      originLongitude: item.exitLongitude as number,
      destinationLatitude: item.entryLatitude as number,
      destinationLongitude: item.entryLongitude as number,
    }));

    const shoppingPoints: TransitPoint[] = shopping.flatMap((item) => {
      const origin = this.resolveCoordinatePair(
        item.departureAnchorLatitude,
        item.departureAnchorLongitude,
      ) ?? this.resolveCoordinatePair(item.latitude, item.longitude);
      const destinationCoordinate = this.resolveCoordinatePair(
        item.arrivalAnchorLatitude,
        item.arrivalAnchorLongitude,
      ) ?? this.resolveCoordinatePair(item.latitude, item.longitude);
      if (!origin || !destinationCoordinate) {
        return [];
      }
      return [
        {
          id: item.id,
          pointType: 'shopping',
          city: item.city,
          province: item.province,
          cityI18n: item.cityI18n,
          transitCityCandidates: this.resolveTransitCityCandidates(
            item.city,
            item.cityI18n,
          ),
          originLatitude: origin.latitude,
          originLongitude: origin.longitude,
          destinationLatitude: destinationCoordinate.latitude,
          destinationLongitude: destinationCoordinate.longitude,
        },
      ];
    });

    const restaurantPoints: TransitPoint[] = restaurants.flatMap((item) => {
      const origin = this.resolveCoordinatePair(
        item.departureAnchorLatitude,
        item.departureAnchorLongitude,
      ) ?? this.resolveCoordinatePair(item.latitude, item.longitude);
      const destinationCoordinate = this.resolveCoordinatePair(
        item.arrivalAnchorLatitude,
        item.arrivalAnchorLongitude,
      ) ?? this.resolveCoordinatePair(item.latitude, item.longitude);
      if (!origin || !destinationCoordinate) {
        return [];
      }
      return [
        {
          id: item.id,
          pointType: 'restaurant',
          city: item.city,
          province: item.province,
          cityI18n: item.cityI18n,
          transitCityCandidates: this.resolveTransitCityCandidates(
            item.city,
            item.cityI18n,
          ),
          originLatitude: origin.latitude,
          originLongitude: origin.longitude,
          destinationLatitude: destinationCoordinate.latitude,
          destinationLongitude: destinationCoordinate.longitude,
        },
      ];
    });

    const hotelPoints: TransitPoint[] = hotels.flatMap((item) => {
      const origin = this.resolveCoordinatePair(
        item.departureAnchorLatitude,
        item.departureAnchorLongitude,
      ) ?? this.resolveCoordinatePair(item.latitude, item.longitude);
      const destinationCoordinate = this.resolveCoordinatePair(
        item.arrivalAnchorLatitude,
        item.arrivalAnchorLongitude,
      ) ?? this.resolveCoordinatePair(item.latitude, item.longitude);
      if (!origin || !destinationCoordinate) {
        return [];
      }
      return [
        {
          id: item.id,
          pointType: 'hotel',
          city: item.city,
          province: item.province,
          cityI18n: item.cityI18n,
          transitCityCandidates: this.resolveTransitCityCandidates(
            item.city,
            item.cityI18n,
          ),
          originLatitude: origin.latitude,
          originLongitude: origin.longitude,
          destinationLatitude: destinationCoordinate.latitude,
          destinationLongitude: destinationCoordinate.longitude,
        },
      ];
    });

    const airportPoints: TransitPoint[] = airports.flatMap((item) => {
      const origin = this.resolveCoordinatePair(
        item.departureAnchorLatitude,
        item.departureAnchorLongitude,
      ) ?? this.resolveCoordinatePair(item.latitude, item.longitude);
      const destinationCoordinate = this.resolveCoordinatePair(
        item.arrivalAnchorLatitude,
        item.arrivalAnchorLongitude,
      ) ?? this.resolveCoordinatePair(item.latitude, item.longitude);
      if (!origin || !destinationCoordinate) {
        return [];
      }
      return [
        {
          id: item.id,
          pointType: 'airport',
          city: item.city?.name ?? city,
          province: item.city?.province?.name ?? normalizedProvince,
          cityI18n: item.city?.nameI18n ?? null,
          transitCityCandidates: this.resolveTransitCityCandidates(
            item.city?.name ?? city,
            item.city?.nameI18n ?? null,
          ),
          originLatitude: origin.latitude,
          originLongitude: origin.longitude,
          destinationLatitude: destinationCoordinate.latitude,
          destinationLongitude: destinationCoordinate.longitude,
        },
      ];
    });

    return [
      ...spotPoints,
      ...shoppingPoints,
      ...restaurantPoints,
      ...hotelPoints,
      ...airportPoints,
    ];
  }

  private toOriginCoordinate(point: TransitPoint): AmapCoordinate {
    return {
      latitude: point.originLatitude,
      longitude: point.originLongitude,
    };
  }

  private toDestinationCoordinate(point: TransitPoint): AmapCoordinate {
    return {
      latitude: point.destinationLatitude,
      longitude: point.destinationLongitude,
    };
  }

  private normalizePointInput(
    point: TransitPointRecomputeInput,
  ): TransitPoint | null {
    const city = point.city.trim();
    if (!city) {
      return null;
    }

    if (point.pointType === 'spot') {
      const entryLatitude = Number(point.entryLatitude);
      const entryLongitude = Number(point.entryLongitude);
      const exitLatitude = Number(point.exitLatitude);
      const exitLongitude = Number(point.exitLongitude);
      if (
        !Number.isFinite(entryLatitude) ||
        !Number.isFinite(entryLongitude) ||
        !Number.isFinite(exitLatitude) ||
        !Number.isFinite(exitLongitude)
      ) {
        return null;
      }

      return {
        id: point.id,
        pointType: point.pointType,
        city,
        province: point.province?.trim() || null,
        cityI18n: point.cityI18n ?? null,
        transitCityCandidates: this.resolveTransitCityCandidates(
          city,
          point.cityI18n ?? null,
        ),
        originLatitude: exitLatitude,
        originLongitude: exitLongitude,
        destinationLatitude: entryLatitude,
        destinationLongitude: entryLongitude,
      };
    }

    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    const origin =
      this.resolveCoordinatePair(
        point.departureAnchorLatitude,
        point.departureAnchorLongitude,
      ) ?? this.resolveCoordinatePair(latitude, longitude);
    const destination =
      this.resolveCoordinatePair(
        point.arrivalAnchorLatitude,
        point.arrivalAnchorLongitude,
      ) ?? this.resolveCoordinatePair(latitude, longitude);
    if (!origin || !destination) {
      return null;
    }

    return {
      id: point.id,
      pointType: point.pointType,
      city,
      province: point.province?.trim() || null,
      cityI18n: point.cityI18n ?? null,
      transitCityCandidates: this.resolveTransitCityCandidates(
        city,
        point.cityI18n ?? null,
      ),
      originLatitude: origin.latitude,
      originLongitude: origin.longitude,
      destinationLatitude: destination.latitude,
      destinationLongitude: destination.longitude,
    };
  }

  private isSamePoint(a: TransitPoint, b: TransitPoint): boolean {
    return a.id === b.id && a.pointType === b.pointType;
  }

  private buildEdgeKey(fromPointId: string, toPointId: string): string {
    return `${fromPointId}->${toPointId}`;
  }

  private async loadExistingEdgeMap(
    city: string,
    province: string | null | undefined,
    pointIds: string[],
  ): Promise<Map<string, TransitCache>> {
    const edges = await this.transitCacheService.findEdgesByCityAndPointIds(
      city,
      pointIds,
      province,
    );
    return new Map(
      edges.map((edge) => [
        this.buildEdgeKey(edge.fromPointId, edge.toPointId),
        edge,
      ]),
    );
  }

  private async recomputeEdgesToDestination(
    origins: TransitPoint[],
    destination: TransitPoint,
    options: TransitPrecomputeOptions & {
      existingEdgeMap?: Map<string, TransitCache>;
    } = {},
  ): Promise<TransitPrecomputeChunkSummary> {
    if (origins.length === 0) {
      return {
        totalEdges: 0,
        transitReadyEdges: 0,
        transitFallbackEdges: 0,
        drivingReadyEdges: 0,
        walkingReadyEdges: 0,
        walkingMinutesReadyEdges: 0,
      };
    }

    const selectedModes = new Set<TransitPrecomputeMode>(
      options.modes && options.modes.length > 0
        ? options.modes
        : ['transit', 'driving', 'walking'],
    );
    const summary: TransitPrecomputeChunkSummary = {
      totalEdges: 0,
      transitReadyEdges: 0,
      transitFallbackEdges: 0,
      drivingReadyEdges: 0,
      walkingReadyEdges: 0,
      walkingMinutesReadyEdges: 0,
    };

    const maxOrigins = this.amapTransitClient.getDistanceMatrixMaxOrigins();
    for (let i = 0; i < origins.length; i += maxOrigins) {
      const originChunk = origins.slice(i, i + maxOrigins);

      const originCoordinates = originChunk.map((item) =>
        this.toOriginCoordinate(item),
      );
      const destinationCoordinate = this.toDestinationCoordinate(destination);

      const [drivingRows, walkingRows, transitRows] = await Promise.all([
        selectedModes.has('driving')
          ? this.fetchDistanceMatrixWithRetry({
              origins: originCoordinates,
              destination: destinationCoordinate,
              mode: 'driving',
            })
          : Promise.resolve(originChunk.map(() => null)),
        selectedModes.has('walking')
          ? this.fetchDistanceMatrixWithRetry({
              origins: originCoordinates,
              destination: destinationCoordinate,
              mode: 'walking',
            })
          : Promise.resolve(originChunk.map(() => null)),
        selectedModes.has('transit')
          ? this.fetchTransitDirectionsWithRetry({
              origins: originCoordinates,
              destination: destinationCoordinate,
              city: destination.city,
              cityCandidates: destination.transitCityCandidates,
            })
          : Promise.resolve(originChunk.map(() => null)),
      ]);

      const chunkSummary: TransitPrecomputeChunkSummary = {
        totalEdges: 0,
        transitReadyEdges: 0,
        transitFallbackEdges: 0,
        drivingReadyEdges: 0,
        walkingReadyEdges: 0,
        walkingMinutesReadyEdges: 0,
      };

      for (let idx = 0; idx < originChunk.length; idx += 1) {
        const origin = originChunk[idx];
        const edgeKey = this.buildEdgeKey(origin.id, destination.id);
        const existingEdge = options.existingEdgeMap?.get(edgeKey) ?? null;
        const driving = drivingRows[idx];
        const walking = walkingRows[idx];
        const transit = transitRows[idx];
        const fallbackDistanceMeters = this.estimateDistanceMeters(
          this.toOriginCoordinate(origin),
          this.toDestinationCoordinate(destination),
        );
        const fallbackDrivingMinutes = this.estimateDrivingMinutes(
          fallbackDistanceMeters,
        );
        const fallbackWalkingMinutes = this.estimateWalkingMinutes(
          fallbackDistanceMeters,
        );
        const fallbackTransitMinutes = this.estimateTransitMinutes(
          fallbackDistanceMeters,
        );

        const drivingMinutes = selectedModes.has('driving')
          ? driving?.durationMinutes ??
            existingEdge?.drivingMinutes ??
            fallbackDrivingMinutes
          : existingEdge?.drivingMinutes ?? fallbackDrivingMinutes;
        const walkingMinutes = selectedModes.has('walking')
          ? walking?.durationMinutes ??
            existingEdge?.walkingMinutes ??
            fallbackWalkingMinutes
          : existingEdge?.walkingMinutes ?? fallbackWalkingMinutes;
        const walkingMeters = selectedModes.has('walking')
          ? walking?.distanceMeters ??
            existingEdge?.walkingMeters ??
            fallbackDistanceMeters
          : existingEdge?.walkingMeters ?? fallbackDistanceMeters;
        const distanceMeters =
          (selectedModes.has('driving') ? driving?.distanceMeters : null) ??
          (selectedModes.has('walking') ? walking?.distanceMeters : null) ??
          (selectedModes.has('transit') ? transit?.distanceMeters : null) ??
          (existingEdge ? Math.round(existingEdge.distanceKm * 1000) : null) ??
          fallbackDistanceMeters;
        const transitMinutes = selectedModes.has('transit')
          ? transit?.durationMinutes ??
            existingEdge?.transitMinutes ??
            fallbackTransitMinutes
          : existingEdge?.transitMinutes ?? fallbackTransitMinutes;
        const transitProviderStatus: TransitProviderStatus = selectedModes.has(
          'transit',
        )
          ? transit?.durationMinutes !== null &&
            transit?.durationMinutes !== undefined
            ? 'ready'
            : existingEdge?.transitProviderStatus ?? 'fallback'
          : existingEdge?.transitProviderStatus ?? 'fallback';
        const provider = this.resolveProvider({
          driving: selectedModes.has('driving') ? driving : null,
          walking: selectedModes.has('walking') ? walking : null,
          transit: selectedModes.has('transit') ? transit : null,
        });

        await this.transitCacheService.upsertEdge({
          city: destination.city,
          province: destination.province,
          fromPointId: origin.id,
          fromPointType: origin.pointType,
          toPointId: destination.id,
          toPointType: destination.pointType,
          transitMinutes,
          drivingMinutes,
          walkingMeters,
          walkingMinutes,
          distanceKm: Number((distanceMeters / 1000).toFixed(3)),
          transitSummary: selectedModes.has('transit')
            ? transit?.summary ?? existingEdge?.transitSummary ?? null
            : existingEdge?.transitSummary ?? null,
          transitSummaryI18n: null,
          transitProviderStatus,
          provider: existingEdge?.provider ?? provider,
          status: 'ready',
        });

        chunkSummary.totalEdges += 1;
        if (transitProviderStatus === 'ready') {
          chunkSummary.transitReadyEdges += 1;
        } else {
          chunkSummary.transitFallbackEdges += 1;
        }
        if (drivingMinutes > 0) {
          chunkSummary.drivingReadyEdges += 1;
        }
        if (walkingMeters > 0) {
          chunkSummary.walkingReadyEdges += 1;
        }
        if (walkingMinutes > 0) {
          chunkSummary.walkingMinutesReadyEdges += 1;
        }
      }

      summary.totalEdges += chunkSummary.totalEdges;
      summary.transitReadyEdges += chunkSummary.transitReadyEdges;
      summary.transitFallbackEdges += chunkSummary.transitFallbackEdges;
      summary.drivingReadyEdges += chunkSummary.drivingReadyEdges;
      summary.walkingReadyEdges += chunkSummary.walkingReadyEdges;
      summary.walkingMinutesReadyEdges += chunkSummary.walkingMinutesReadyEdges;
      await options.onChunkProgress?.(chunkSummary);
    }

    return summary;
  }

  private async fetchDistanceMatrixWithRetry(input: {
    origins: AmapCoordinate[];
    destination: AmapCoordinate;
    mode: 'driving' | 'walking';
  }): Promise<AmapMatrixItem[]> {
    let attempt = 0;
    while (attempt <= TransitCachePrecomputeService.MATRIX_REQUEST_RETRIES) {
      try {
        return await this.amapTransitClient.getDistanceMatrixToDestination(input);
      } catch (error) {
        const isLast =
          attempt === TransitCachePrecomputeService.MATRIX_REQUEST_RETRIES;
        this.logger.warn(
          `Amap matrix request error mode=${input.mode} attempt=${attempt + 1}: ${(error as Error).message}`,
        );
        if (isLast) {
          break;
        }
        await this.delay((attempt + 1) * 300);
      }
      attempt += 1;
    }

    return input.origins.map(() => ({
      distanceMeters: null,
      durationMinutes: null,
    }));
  }

  private async fetchTransitDirectionsWithRetry(input: {
    origins: AmapCoordinate[];
    destination: AmapCoordinate;
    city?: string | null;
    cityCandidates?: string[];
  }): Promise<Array<AmapDirectionResult | null>> {
    let attempt = 0;
    while (attempt <= TransitCachePrecomputeService.MATRIX_REQUEST_RETRIES) {
      try {
        return await this.amapTransitClient.getTransitDirectionsToDestination({
          origins: input.origins,
          destination: input.destination,
          city: input.city,
          cityCandidates: input.cityCandidates,
        });
      } catch (error) {
        const isLast =
          attempt === TransitCachePrecomputeService.MATRIX_REQUEST_RETRIES;
        this.logger.warn(
          `Amap transit direction request error attempt=${attempt + 1}: ${(error as Error).message}`,
        );
        if (isLast) {
          break;
        }
        await this.delay((attempt + 1) * 300);
      }
      attempt += 1;
    }

    return input.origins.map(() => null);
  }

  private resolveProvider(input: {
    driving?: AmapMatrixItem | null;
    walking?: AmapMatrixItem | null;
    transit?: AmapDirectionResult | null;
  }): string {
    const hasDriving =
      input.driving?.durationMinutes !== null &&
      input.driving?.durationMinutes !== undefined;
    const hasWalking =
      input.walking?.durationMinutes !== null &&
      input.walking?.durationMinutes !== undefined;
    const hasTransit =
      input.transit?.durationMinutes !== null &&
      input.transit?.durationMinutes !== undefined;

    if (hasDriving && hasWalking && hasTransit) {
      return 'amap';
    }
    if (hasDriving || hasWalking || hasTransit) {
      return 'amap_partial';
    }
    return 'fallback';
  }

  private resolveCoordinatePair(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ): AmapCoordinate | null {
    if (
      typeof latitude === 'number' &&
      Number.isFinite(latitude) &&
      typeof longitude === 'number' &&
      Number.isFinite(longitude)
    ) {
      return {
        latitude,
        longitude,
      };
    }
    return null;
  }

  private resolveTransitCityCandidates(
    city: string,
    cityI18n?: Record<string, string | undefined> | null,
  ): string[] {
    const normalized: string[] = [];
    const seen = new Set<string>();

    const push = (value?: string | null) => {
      const trimmed = value?.trim();
      if (!trimmed || seen.has(trimmed)) {
        return;
      }
      seen.add(trimmed);
      normalized.push(trimmed);

      if (/市$/.test(trimmed)) {
        const withoutSuffix = trimmed.replace(/市$/, '');
        if (withoutSuffix && !seen.has(withoutSuffix)) {
          seen.add(withoutSuffix);
          normalized.push(withoutSuffix);
        }
      }
    };

    push(cityI18n?.['zh-CN']);
    push(city);
    push(cityI18n?.['en-US']);
    push(cityI18n?.['mn-MN']);

    return normalized;
  }

  private estimateDistanceMeters(a: AmapCoordinate, b: AmapCoordinate): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const lat1 = toRad(a.latitude);
    const lng1 = toRad(a.longitude);
    const lat2 = toRad(b.latitude);
    const lng2 = toRad(b.longitude);
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const meters = 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return Math.max(1, Math.round(meters));
  }

  private estimateDrivingMinutes(distanceMeters: number): number {
    const distanceKm = distanceMeters / 1000;
    return Math.max(1, Math.round((distanceKm / 25) * 60 + 6));
  }

  private estimateWalkingMinutes(distanceMeters: number): number {
    const distanceKm = distanceMeters / 1000;
    return Math.max(1, Math.round((distanceKm / 4.5) * 60));
  }

  private estimateTransitMinutes(distanceMeters: number): number {
    const distanceKm = distanceMeters / 1000;
    return Math.max(4, Math.round((distanceKm / 18) * 60 + 12));
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
