import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ContentLang,
  ensureGuideI18n,
  ensureIntroI18n,
  ensureRegionI18n,
  ensureTextI18n,
  resolveIntro,
  resolveName,
} from '../../common/utils/content-i18n.util';
import { PlannerConfig } from '../../config/planner.config';
import { HotelPlace } from '../hotels/entities/hotel.entity';
import { LocationAirport } from '../locations/entities/location-airport.entity';
import { RestaurantPlace } from '../restaurants/entities/restaurant.entity';
import { ShoppingPlace } from '../shopping/entities/shopping.entity';
import { Spot } from '../spots/entities/spot.entity';
import {
  AmapCoordinate,
  AmapDirectionResult,
  AmapTransitClient,
} from '../transit-cache/amap/amap-transit.client';
import { TransitCache } from '../transit-cache/entities/transit-cache.entity';
import { TransitCacheService } from '../transit-cache/transit-cache.service';
import { GenerateItineraryDto } from './dto/generate-itinerary.dto';
import { ListCityPointsQueryDto } from './dto/list-city-points-query.dto';
import { ListTripCitiesQueryDto } from './dto/list-trip-cities-query.dto';
import {
  OptimizerClient,
  OptimizerDistanceMatrixRow,
  OptimizerSolveResponse,
} from './optimizer.client';
import { TripPlannerCacheService } from './trip-planner-cache.service';
import {
  GeneratedTripResult,
  PlannerHotelCandidate,
  PlannerLang,
  PlannerPointView,
  TripPlannerMatrixCheckResult,
  TripCityItem,
} from './trip-planner.types';

interface GroupedCityRow {
  province: string;
  city: string;
  count: string;
}

interface GeneratedPlannerPoint {
  id: string;
  pointType: 'spot' | 'shopping' | 'restaurant';
  name: string;
  suggestedDurationMinutes: number;
  guideI18n: Record<string, string | undefined>;
  city: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
}

interface PlannerNodeCoordinate {
  latitude: number;
  longitude: number;
}

interface PlannerGenerationContext {
  city: string;
  province: string;
  selectedPoints: GeneratedPlannerPoint[];
  hotelCandidates: PlannerHotelCandidate[];
  arrivalAirport: LocationAirport | null;
  departureAirport: LocationAirport | null;
  allNodeIds: string[];
  cacheEdges: TransitCache[];
  matrixRows: OptimizerDistanceMatrixRow[];
}

const RESTAURANT_MEAL_SLOTS = new Set<string>([
  'breakfast',
  'lunch',
  'dinner',
  'night_snack',
]);

@Injectable()
export class TripPlannerService {
  private readonly config: PlannerConfig;

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
    private readonly tripPlannerCacheService: TripPlannerCacheService,
    private readonly transitCacheService: TransitCacheService,
    private readonly amapTransitClient: AmapTransitClient,
    private readonly optimizerClient: OptimizerClient,
    private readonly configService: ConfigService,
  ) {
    this.config = this.configService.get<PlannerConfig>(
      'planner',
    ) as PlannerConfig;
  }

  async listCities(query: ListTripCitiesQueryDto): Promise<{
    total: number;
    items: TripCityItem[];
  }> {
    const cacheKey = `trip-cities:${query.limit}:${query.offset}`;
    return this.tripPlannerCacheService.remember(cacheKey, async () => {
      const [spotGroups, shoppingGroups, restaurantGroups] = await Promise.all([
        this.spotRepository
          .createQueryBuilder('spot')
          .select('spot.province', 'province')
          .addSelect('spot.city', 'city')
          .addSelect('COUNT(spot.id)', 'count')
          .where('spot."isPublished" = true')
          .andWhere("spot.province <> ''")
          .andWhere("spot.city <> ''")
          .groupBy('spot.province')
          .addGroupBy('spot.city')
          .getRawMany<GroupedCityRow>(),
        this.shoppingRepository
          .createQueryBuilder('shopping')
          .select('shopping.province', 'province')
          .addSelect('shopping.city', 'city')
          .addSelect('COUNT(shopping.id)', 'count')
          .where('shopping."isPublished" = true')
          .andWhere("shopping.province <> ''")
          .andWhere("shopping.city <> ''")
          .groupBy('shopping.province')
          .addGroupBy('shopping.city')
          .getRawMany<GroupedCityRow>(),
        this.restaurantRepository
          .createQueryBuilder('restaurant')
          .select('restaurant.province', 'province')
          .addSelect('restaurant.city', 'city')
          .addSelect('COUNT(restaurant.id)', 'count')
          .where('restaurant."isPublished" = true')
          .andWhere("restaurant.province <> ''")
          .andWhere("restaurant.city <> ''")
          .groupBy('restaurant.province')
          .addGroupBy('restaurant.city')
          .getRawMany<GroupedCityRow>(),
      ]);

      const merged = new Map<string, TripCityItem>();
      const mergeItem = (
        province: string,
        city: string,
        spotsCount: number,
        shoppingCount: number,
        restaurantsCount: number,
      ) => {
        const key = `${province}\u0000${city}`;
        const current = merged.get(key);
        if (!current) {
          merged.set(key, {
            province,
            city,
            spotsCount,
            shoppingCount,
            restaurantsCount,
          });
          return;
        }
        current.spotsCount += spotsCount;
        current.shoppingCount += shoppingCount;
        current.restaurantsCount += restaurantsCount;
      };

      for (const row of spotGroups) {
        mergeItem(
          row.province.trim(),
          row.city.trim(),
          parseInt(row.count ?? '0', 10),
          0,
          0,
        );
      }
      for (const row of shoppingGroups) {
        mergeItem(
          row.province.trim(),
          row.city.trim(),
          0,
          parseInt(row.count ?? '0', 10),
          0,
        );
      }
      for (const row of restaurantGroups) {
        mergeItem(
          row.province.trim(),
          row.city.trim(),
          0,
          0,
          parseInt(row.count ?? '0', 10),
        );
      }

      const ordered = Array.from(merged.values()).sort((a, b) => {
        const aTotal = a.spotsCount + a.shoppingCount + a.restaurantsCount;
        const bTotal = b.spotsCount + b.shoppingCount + b.restaurantsCount;
        if (aTotal !== bTotal) {
          return bTotal - aTotal;
        }
        if (a.province !== b.province) {
          return a.province.localeCompare(b.province);
        }
        return a.city.localeCompare(b.city);
      });

      return {
        total: ordered.length,
        items: ordered.slice(query.offset, query.offset + query.limit),
      };
    });
  }

  async listCityPoints(
    cityParam: string,
    query: ListCityPointsQueryDto,
  ): Promise<{
    city: string;
    province: string | null;
    total: number;
    spotsCount: number;
    shoppingCount: number;
    restaurantsCount: number;
    items: PlannerPointView[];
    outboundFlight: string;
  }> {
    const city = this.normalizeRequired(cityParam, 'city');
    const province = this.normalizeOptional(query.province);
    const lang = this.resolveLang(query.lang);
    const cacheKey = `trip-city-points:${city.toLowerCase()}:${(province ?? '').toLowerCase()}:${lang}`;

    return this.tripPlannerCacheService.remember(cacheKey, async () => {
      const [spots, shopping, restaurants] = await Promise.all([
        this.querySpotsByCity(city, province),
        this.queryShoppingByCity(city, province),
        this.queryRestaurantsByCity(city, province),
      ]);

      const mappedSpots = spots.map((item) =>
        this.mapSpotToPlannerPoint(item, lang),
      );
      const mappedShopping = shopping.map((item) =>
        this.mapShoppingToPlannerPoint(item, lang),
      );
      const mappedRestaurants = restaurants.map((item) =>
        this.mapRestaurantToPlannerPoint(item, lang),
      );

      const items = [...mappedSpots, ...mappedShopping, ...mappedRestaurants].sort(
        (a, b) => {
        if (a.pointType !== b.pointType) {
          return a.pointType.localeCompare(b.pointType);
        }
        return a.name.localeCompare(b.name);
        },
      );

      const resolvedProvince =
        province ??
        this.inferSingleProvince(items.map((item) => item.province));

      return {
        city,
        province: resolvedProvince,
        total: items.length,
        spotsCount: mappedSpots.length,
        shoppingCount: mappedShopping.length,
        restaurantsCount: mappedRestaurants.length,
        items,
        outboundFlight: this.buildFlightLink({
          direction: 'outbound',
          city,
          province: resolvedProvince ?? '',
          dateTime: null,
        }),
      };
    });
  }

  async generateItinerary(
    dto: GenerateItineraryDto,
  ): Promise<GeneratedTripResult> {
    const context = await this.prepareGenerationContext(dto);
    const city = context.city;
    const resolvedProvince = context.province;
    const selectedPoints = context.selectedPoints;
    const hotelCandidates = context.hotelCandidates;
    const arrivalAirport = context.arrivalAirport;
    const departureAirport = context.departureAirport;
    const cacheEdges = context.cacheEdges;
    const matrixRows = context.matrixRows;

    let solverResult: OptimizerSolveResponse;
    try {
      solverResult = await this.optimizerClient.solve({
        city,
        province: resolvedProvince,
        arrivalAirportCode: dto.arrivalAirportCode,
        departureAirportCode: dto.departureAirportCode,
        arrivalAirportId: arrivalAirport?.id,
        departureAirportId: departureAirport?.id,
        arrivalAirport: arrivalAirport
          ? {
              latitude: arrivalAirport.latitude,
              longitude: arrivalAirport.longitude,
            }
          : undefined,
        departureAirport: departureAirport
          ? {
              latitude: departureAirport.latitude,
              longitude: departureAirport.longitude,
            }
          : undefined,
        arrivalDateTime: dto.arrivalDateTime,
        airportBufferMinutes: dto.arrivalBufferMinutes,
        paceMode: dto.paceMode,
        hotelMode: dto.hotelMode,
        mealPolicy: dto.mealPolicy ?? 'auto',
        points: selectedPoints.map((item) => ({
          id: item.id,
          pointType: item.pointType,
          suggestedDurationMinutes: item.suggestedDurationMinutes,
          latitude: item.latitude,
          longitude: item.longitude,
        })),
        hotels: hotelCandidates.map((item) => ({
          id: item.id,
          latitude: item.latitude,
          longitude: item.longitude,
        })),
        distanceMatrix: {
          rows: matrixRows,
        },
        objective: 'min_days_then_transit',
        maxDays: 14,
        timeLimitSeconds:
          dto.timeLimitSeconds ?? this.optimizerClient.getDefaultTimeLimitSeconds(),
        switchPenaltyMinutes: dto.switchPenaltyMinutes,
        newHotelPenaltyMinutes: dto.newHotelPenaltyMinutes,
        maxIterations: dto.maxIterations,
        badDayTransitMinutesThreshold: dto.badDayTransitMinutesThreshold,
        badDayPenaltyMinutes: dto.badDayPenaltyMinutes,
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'TRIP_PLANNER_OPTIMIZER_UNAVAILABLE',
        message:
          'Trip itinerary generation is temporarily unavailable because optimizer request failed.',
        details: {
          reason: error instanceof Error ? error.message : 'Unknown optimizer error',
        },
      });
    }

    const pointById = new Map(selectedPoints.map((item) => [item.id, item] as const));
    const hotelById = new Map(hotelCandidates.map((item) => [item.id, item] as const));
    const edgeMap = this.buildTransitEdgeMap(cacheEdges);
    const nodeCoordinateMap = this.buildNodeCoordinateMap({
      points: selectedPoints,
      hotels: hotelCandidates,
      arrivalAirport,
      departureAirport,
    });
    const transitDirectionCache = new Map<string, Promise<AmapDirectionResult | null>>();
    const days = await this.buildGeneratedDays({
      city,
      province: resolvedProvince,
      days: solverResult.days,
      pointById,
      hotelById,
      edgeMap,
      arrivalAirportId: arrivalAirport?.id ?? null,
      nodeCoordinateMap,
      transitDirectionCache,
    });

    const returnFlightDateTime = this.buildReturnFlightDateTime(
      dto.arrivalDateTime,
      solverResult.tripDays,
    );

    return {
      city,
      province: resolvedProvince,
      arrivalDateTime: dto.arrivalDateTime,
      arrivalBufferMinutes: dto.arrivalBufferMinutes,
      tripDays: solverResult.tripDays,
      solverStatus: solverResult.solverStatus,
      days,
      links: {
        outboundFlight: this.buildFlightLink({
          direction: 'outbound',
          city,
          province: resolvedProvince,
          dateTime: dto.arrivalDateTime,
        }),
        returnFlight: this.buildFlightLink({
          direction: 'return',
          city,
          province: resolvedProvince,
          dateTime: returnFlightDateTime,
        }),
      },
      optimizerDiagnostics: solverResult.diagnostics,
    };
  }

  async checkMatrixCoverage(
    dto: GenerateItineraryDto,
  ): Promise<TripPlannerMatrixCheckResult> {
    const context = await this.prepareGenerationContext(dto);
    const nodeIds = Array.from(new Set(context.allNodeIds));
    const nodeCount = nodeIds.length;

    const readyDirectedKeySet = new Set(
      context.cacheEdges.map((edge) =>
        this.buildEdgeKey(edge.fromPointId, edge.toPointId),
      ),
    );

    const expectedDirected = nodeCount <= 1 ? 0 : nodeCount * (nodeCount - 1);
    const readyDirected = readyDirectedKeySet.size;
    const missingDirected = Math.max(0, expectedDirected - readyDirected);

    let expectedUndirected = 0;
    let readyUndirected = 0;
    const missingEdgesSample: Array<{ fromPointId: string; toPointId: string }> = [];
    const maxMissingSample = 120;

    for (let i = 0; i < nodeIds.length; i += 1) {
      for (let j = i + 1; j < nodeIds.length; j += 1) {
        expectedUndirected += 1;
        const fromPointId = nodeIds[i];
        const toPointId = nodeIds[j];
        const direct = this.buildEdgeKey(fromPointId, toPointId);
        const reverse = this.buildEdgeKey(toPointId, fromPointId);
        if (readyDirectedKeySet.has(direct) || readyDirectedKeySet.has(reverse)) {
          readyUndirected += 1;
          continue;
        }
        if (missingEdgesSample.length < maxMissingSample) {
          missingEdgesSample.push({ fromPointId, toPointId });
        }
      }
    }

    const missingUndirected = Math.max(0, expectedUndirected - readyUndirected);
    const airportNodeCount = new Set(
      [context.arrivalAirport?.id, context.departureAirport?.id].filter(
        (item): item is string => typeof item === 'string' && item.length > 0,
      ),
    ).size;

    return {
      city: context.city,
      province: context.province,
      nodeCount,
      pointCount: context.selectedPoints.length,
      hotelCount: context.hotelCandidates.length,
      airportCount: airportNodeCount,
      directed: {
        expected: expectedDirected,
        ready: readyDirected,
        missing: missingDirected,
        coverage: this.toCoverage(expectedDirected, readyDirected),
      },
      undirected: {
        expected: expectedUndirected,
        ready: readyUndirected,
        missing: missingUndirected,
        coverage: this.toCoverage(expectedUndirected, readyUndirected),
      },
      missingEdgesSample,
      canGenerate: missingUndirected === 0,
    };
  }

  private async prepareGenerationContext(
    dto: GenerateItineraryDto,
  ): Promise<PlannerGenerationContext> {
    const city = this.normalizeRequired(dto.city, 'city');
    const requestedProvince = this.normalizeOptional(dto.province);
    const selectedPointIds = Array.from(
      new Set(
        dto.selectedPointIds
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    );
    if (selectedPointIds.length === 0) {
      throw new BadRequestException({
        code: 'TRIP_PLANNER_POINTS_REQUIRED',
        message: 'selectedPointIds is required.',
      });
    }

    const [spots, shopping, restaurants] = await Promise.all([
      this.querySpotsByIds(selectedPointIds),
      this.queryShoppingByIds(selectedPointIds),
      this.queryRestaurantsByIds(selectedPointIds),
    ]);

    const selectedPointMap = new Map<string, GeneratedPlannerPoint>();
    for (const spot of spots) {
      selectedPointMap.set(spot.id, this.mapSpotToGeneratedPlannerPoint(spot));
    }
    for (const item of shopping) {
      selectedPointMap.set(
        item.id,
        this.mapShoppingToGeneratedPlannerPoint(item),
      );
    }
    for (const item of restaurants) {
      selectedPointMap.set(
        item.id,
        this.mapRestaurantToGeneratedPlannerPoint(item),
      );
    }

    if (selectedPointMap.size !== selectedPointIds.length) {
      const missingIds = selectedPointIds.filter((id) => !selectedPointMap.has(id));
      throw new NotFoundException({
        code: 'TRIP_PLANNER_POINTS_NOT_FOUND',
        message: 'Some selected points are not found or unpublished.',
        details: { missingIds },
      });
    }

    const selectedPoints = selectedPointIds.map((id) => selectedPointMap.get(id)!);
    this.assertSolverReadySelectedPoints(selectedPoints);

    for (const point of selectedPoints) {
      this.assertPointWithinCity(point.pointType, point.id, point.city, city);
      if (requestedProvince) {
        this.assertPointWithinProvince(
          point.pointType,
          point.id,
          point.province,
          requestedProvince,
        );
      }
    }

    const resolvedProvince =
      requestedProvince ??
      this.inferSingleProvince(selectedPoints.map((item) => item.province));
    if (!resolvedProvince) {
      throw new BadRequestException({
        code: 'TRIP_PLANNER_PROVINCE_REQUIRED',
        message:
          'province is required when selected points cannot infer a unique province.',
      });
    }

    const hotels = await this.queryHotelsByCity(city, resolvedProvince);
    if (hotels.length === 0) {
      throw new NotFoundException({
        code: 'TRIP_PLANNER_HOTELS_NOT_FOUND',
        message: 'No published hotels found in target city.',
      });
    }
    const hotelCandidates = hotels.map((item) => this.mapHotelCandidate(item));
    this.assertSolverReadyHotels(hotelCandidates);

    const [arrivalAirport, departureAirport] = await Promise.all([
      this.resolveAirportByCode(dto.arrivalAirportCode, city, resolvedProvince),
      this.resolveAirportByCode(dto.departureAirportCode, city, resolvedProvince),
    ]);
    this.assertSolverReadyAirport(arrivalAirport, 'arrivalAirportCode');
    this.assertSolverReadyAirport(departureAirport, 'departureAirportCode');

    const allNodeIds = [
      ...selectedPoints.map((item) => item.id),
      ...hotelCandidates.map((item) => item.id),
      ...(arrivalAirport ? [arrivalAirport.id] : []),
      ...(departureAirport ? [departureAirport.id] : []),
    ];

    const cacheEdges = await this.transitCacheService.findReadyEdgesByCityAndPointIds(
      city,
      allNodeIds,
    );

    return {
      city,
      province: resolvedProvince,
      selectedPoints,
      hotelCandidates,
      arrivalAirport,
      departureAirport,
      allNodeIds,
      cacheEdges,
      matrixRows: cacheEdges.map((edge) => this.mapTransitEdgeToMatrixRow(edge)),
    };
  }

  private toCoverage(expected: number, ready: number): number {
    if (expected <= 0) {
      return 1;
    }
    const value = ready / expected;
    return Number(Math.max(0, Math.min(1, value)).toFixed(4));
  }

  private async querySpotsByCity(
    city: string,
    province?: string | null,
  ): Promise<Spot[]> {
    const qb = this.spotRepository
      .createQueryBuilder('spot')
      .where('spot."isPublished" = true')
      .andWhere('LOWER(spot.city) = LOWER(:city)', { city });

    if (province) {
      qb.andWhere('LOWER(spot.province) = LOWER(:province)', {
        province,
      });
    }

    return qb
      .orderBy('spot."createdAt"', 'DESC')
      .addOrderBy('spot.name', 'ASC')
      .getMany();
  }

  private async queryShoppingByCity(
    city: string,
    province?: string | null,
  ): Promise<ShoppingPlace[]> {
    const qb = this.shoppingRepository
      .createQueryBuilder('shopping')
      .where('shopping."isPublished" = true')
      .andWhere('LOWER(shopping.city) = LOWER(:city)', { city });

    if (province) {
      qb.andWhere('LOWER(shopping.province) = LOWER(:province)', {
        province,
      });
    }

    return qb
      .orderBy('shopping."createdAt"', 'DESC')
      .addOrderBy('shopping.name', 'ASC')
      .getMany();
  }

  private async queryRestaurantsByCity(
    city: string,
    province?: string | null,
  ): Promise<RestaurantPlace[]> {
    const qb = this.restaurantRepository
      .createQueryBuilder('restaurant')
      .where('restaurant."isPublished" = true')
      .andWhere('LOWER(restaurant.city) = LOWER(:city)', { city });

    if (province) {
      qb.andWhere('LOWER(restaurant.province) = LOWER(:province)', {
        province,
      });
    }

    return qb
      .orderBy('restaurant."createdAt"', 'DESC')
      .addOrderBy('restaurant.name', 'ASC')
      .getMany();
  }

  private async queryHotelsByCity(
    city: string,
    province: string,
  ): Promise<HotelPlace[]> {
    return this.hotelRepository
      .createQueryBuilder('hotel')
      .where('hotel."isPublished" = true')
      .andWhere('LOWER(hotel.city) = LOWER(:city)', { city })
      .andWhere('LOWER(hotel.province) = LOWER(:province)', { province })
      .orderBy('hotel."starLevel"', 'DESC', 'NULLS LAST')
      .addOrderBy('hotel.name', 'ASC')
      .getMany();
  }

  private async querySpotsByIds(ids: string[]): Promise<Spot[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.spotRepository.find({
      where: {
        id: In(ids),
        isPublished: true,
      },
    });
  }

  private async queryShoppingByIds(ids: string[]): Promise<ShoppingPlace[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.shoppingRepository.find({
      where: {
        id: In(ids),
        isPublished: true,
      },
    });
  }

  private async queryRestaurantsByIds(
    ids: string[],
  ): Promise<RestaurantPlace[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.restaurantRepository.find({
      where: {
        id: In(ids),
        isPublished: true,
      },
    });
  }

  private async resolveAirportByCode(
    airportCode: string | undefined,
    city: string,
    province: string,
  ): Promise<LocationAirport | null> {
    if (!airportCode) {
      return null;
    }
    const normalizedCode = airportCode.trim().toUpperCase();
    if (!normalizedCode) {
      return null;
    }

    const airport = await this.airportRepository
      .createQueryBuilder('airport')
      .leftJoinAndSelect('airport.city', 'city')
      .leftJoinAndSelect('city.province', 'province')
      .where('airport."airportCode" = :airportCode', {
        airportCode: normalizedCode,
      })
      .andWhere('LOWER(city.name) = LOWER(:city)', { city })
      .andWhere('LOWER(province.name) = LOWER(:province)', { province })
      .getOne();

    if (!airport) {
      throw new NotFoundException({
        code: 'TRIP_PLANNER_AIRPORT_NOT_FOUND',
        message: `Airport code ${normalizedCode} is not found in target city.`,
      });
    }
    return airport;
  }

  private mapSpotToGeneratedPlannerPoint(spot: Spot): GeneratedPlannerPoint {
    return {
      id: spot.id,
      pointType: 'spot',
      name: ensureTextI18n(spot.nameI18n, spot.name)['zh-CN'],
      suggestedDurationMinutes: spot.suggestedDurationMinutes,
      guideI18n: ensureGuideI18n(spot.guideI18n),
      city: spot.city,
      province: spot.province,
      latitude:
        typeof spot.entryLatitude === 'number' &&
        Number.isFinite(spot.entryLatitude)
          ? spot.entryLatitude
          : typeof spot.exitLatitude === 'number' &&
              Number.isFinite(spot.exitLatitude)
            ? spot.exitLatitude
          : null,
      longitude:
        typeof spot.entryLongitude === 'number' &&
        Number.isFinite(spot.entryLongitude)
          ? spot.entryLongitude
          : typeof spot.exitLongitude === 'number' &&
              Number.isFinite(spot.exitLongitude)
            ? spot.exitLongitude
          : null,
    };
  }

  private mapShoppingToGeneratedPlannerPoint(
    item: ShoppingPlace,
  ): GeneratedPlannerPoint {
    return {
      id: item.id,
      pointType: 'shopping',
      name: ensureTextI18n(item.nameI18n, item.name)['zh-CN'],
      suggestedDurationMinutes: item.suggestedDurationMinutes,
      guideI18n: ensureGuideI18n(item.guideI18n),
      city: item.city,
      province: item.province,
      latitude:
        typeof item.latitude === 'number' && Number.isFinite(item.latitude)
          ? item.latitude
          : null,
      longitude:
        typeof item.longitude === 'number' && Number.isFinite(item.longitude)
          ? item.longitude
          : null,
    };
  }

  private mapRestaurantToGeneratedPlannerPoint(
    item: RestaurantPlace,
  ): GeneratedPlannerPoint {
    return {
      id: item.id,
      pointType: 'restaurant',
      name: ensureTextI18n(item.nameI18n, item.name)['zh-CN'],
      suggestedDurationMinutes: item.suggestedDurationMinutes,
      guideI18n: ensureGuideI18n(item.guideI18n),
      city: item.city,
      province: item.province,
      latitude:
        typeof item.latitude === 'number' && Number.isFinite(item.latitude)
          ? item.latitude
          : null,
      longitude:
        typeof item.longitude === 'number' && Number.isFinite(item.longitude)
          ? item.longitude
          : null,
    };
  }

  private mapTransitEdgeToMatrixRow(edge: TransitCache): OptimizerDistanceMatrixRow {
    return {
      fromPointId: edge.fromPointId,
      toPointId: edge.toPointId,
      transitMinutes: edge.transitMinutes,
      drivingMinutes: edge.drivingMinutes,
      walkingMeters: edge.walkingMeters,
      distanceKm: edge.distanceKm,
      transitSummary: edge.transitSummary,
    };
  }

  private buildTransitEdgeMap(edges: TransitCache[]): Map<string, TransitCache> {
    return new Map(
      edges.map((item) => [
        this.buildEdgeKey(item.fromPointId, item.toPointId),
        item,
      ] as const),
    );
  }

  private buildNodeCoordinateMap(params: {
    points: GeneratedPlannerPoint[];
    hotels: PlannerHotelCandidate[];
    arrivalAirport: LocationAirport | null;
    departureAirport: LocationAirport | null;
  }): Map<string, PlannerNodeCoordinate> {
    const map = new Map<string, PlannerNodeCoordinate>();

    for (const point of params.points) {
      if (
        typeof point.latitude === 'number' &&
        Number.isFinite(point.latitude) &&
        typeof point.longitude === 'number' &&
        Number.isFinite(point.longitude)
      ) {
        map.set(point.id, {
          latitude: point.latitude,
          longitude: point.longitude,
        });
      }
    }

    for (const hotel of params.hotels) {
      if (
        typeof hotel.latitude === 'number' &&
        Number.isFinite(hotel.latitude) &&
        typeof hotel.longitude === 'number' &&
        Number.isFinite(hotel.longitude)
      ) {
        map.set(hotel.id, {
          latitude: hotel.latitude,
          longitude: hotel.longitude,
        });
      }
    }

    for (const airport of [params.arrivalAirport, params.departureAirport]) {
      if (
        airport &&
        typeof airport.latitude === 'number' &&
        Number.isFinite(airport.latitude) &&
        typeof airport.longitude === 'number' &&
        Number.isFinite(airport.longitude)
      ) {
        map.set(airport.id, {
          latitude: airport.latitude,
          longitude: airport.longitude,
        });
      }
    }

    return map;
  }

  private async buildGeneratedDays(params: {
    city: string;
    province: string;
    days: OptimizerSolveResponse['days'];
    pointById: Map<string, GeneratedPlannerPoint>;
    hotelById: Map<string, PlannerHotelCandidate>;
    edgeMap: Map<string, TransitCache>;
    arrivalAirportId: string | null;
    nodeCoordinateMap: Map<string, PlannerNodeCoordinate>;
    transitDirectionCache: Map<string, Promise<AmapDirectionResult | null>>;
  }): Promise<GeneratedTripResult['days']> {
    const result: GeneratedTripResult['days'] = [];

    for (let dayIndex = 0; dayIndex < params.days.length; dayIndex += 1) {
      const day = params.days[dayIndex];
      const hotel = params.hotelById.get(day.hotelId);
      if (!hotel) {
        throw new ServiceUnavailableException({
          code: 'TRIP_PLANNER_INVALID_SOLVER_OUTPUT',
          message: `Optimizer returned unknown hotelId=${day.hotelId}.`,
        });
      }

      const previousHotelId =
        dayIndex > 0 ? params.days[dayIndex - 1]?.hotelId ?? null : null;
      const legs = await this.buildGeneratedLegs({
        city: params.city,
        dayPointIds: day.pointIds,
        currentHotelId: day.hotelId,
        previousHotelId,
        arrivalAirportId: dayIndex === 0 ? params.arrivalAirportId : null,
        edgeMap: params.edgeMap,
        nodeCoordinateMap: params.nodeCoordinateMap,
        transitDirectionCache: params.transitDirectionCache,
      });

      const points = day.pointIds.map((pointId) => {
        const point = params.pointById.get(pointId);
        if (!point) {
          throw new ServiceUnavailableException({
            code: 'TRIP_PLANNER_INVALID_SOLVER_OUTPUT',
            message: `Optimizer returned unknown pointId=${pointId}.`,
          });
        }
        return {
          id: point.id,
          pointType: point.pointType,
          name: point.name,
          suggestedDurationMinutes: point.suggestedDurationMinutes,
          guideI18n: point.guideI18n,
        };
      });

      result.push({
        dayNumber: day.dayNumber,
        date: day.date,
        hotel: {
          id: hotel.id,
          name: hotel.name,
          bookingUrl:
            hotel.bookingUrl ??
            this.buildHotelLink({
              city: params.city,
              province: params.province,
              checkInDate: day.date,
              checkOutDate: this.addDaysToIsoDate(day.date, 1),
            }),
        },
        legs,
        points,
      });
    }

    return result;
  }

  private async buildGeneratedLegs(params: {
    city: string;
    dayPointIds: string[];
    currentHotelId: string;
    previousHotelId: string | null;
    arrivalAirportId: string | null;
    edgeMap: Map<string, TransitCache>;
    nodeCoordinateMap: Map<string, PlannerNodeCoordinate>;
    transitDirectionCache: Map<string, Promise<AmapDirectionResult | null>>;
  }): Promise<GeneratedTripResult['days'][number]['legs']> {
    const legPairs: Array<{ fromPointId: string; toPointId: string }> = [];
    if (params.dayPointIds.length === 0) {
      return [];
    }

    const firstPointId = params.dayPointIds[0];
    const lastPointId = params.dayPointIds[params.dayPointIds.length - 1];

    if (params.arrivalAirportId) {
      legPairs.push({
        fromPointId: params.arrivalAirportId,
        toPointId: firstPointId,
      });
    } else if (params.previousHotelId) {
      legPairs.push({
        fromPointId: params.previousHotelId,
        toPointId: firstPointId,
      });
    }

    for (let idx = 0; idx < params.dayPointIds.length - 1; idx += 1) {
      legPairs.push({
        fromPointId: params.dayPointIds[idx],
        toPointId: params.dayPointIds[idx + 1],
      });
    }

    legPairs.push({
      fromPointId: lastPointId,
      toPointId: params.currentHotelId,
    });

    return Promise.all(legPairs.map(async ({ fromPointId, toPointId }) => {
      const edge = this.resolveTransitEdge(params.edgeMap, fromPointId, toPointId);
      const transitDirection = await this.fetchLegTransitDirection({
        city: params.city,
        fromPointId,
        toPointId,
        walkingMeters: edge.walkingMeters,
        nodeCoordinateMap: params.nodeCoordinateMap,
        transitDirectionCache: params.transitDirectionCache,
      });
      const transitMinutes =
        transitDirection?.durationMinutes ?? edge.transitMinutes;

      return {
        fromPointId,
        toPointId,
        transportMode: this.chooseTransportMode(
          {
            transitMinutes,
            drivingMinutes: edge.drivingMinutes,
            walkingMeters: edge.walkingMeters,
          },
          transitDirection?.durationMinutes !== null &&
            transitDirection?.durationMinutes !== undefined,
        ),
        transitMinutes,
        drivingMinutes: edge.drivingMinutes,
        walkingMeters: edge.walkingMeters,
        distanceKm: edge.distanceKm,
        transitSummary: transitDirection?.summary ?? null,
      };
    }));
  }

  private async fetchLegTransitDirection(params: {
    city: string;
    fromPointId: string;
    toPointId: string;
    walkingMeters: number;
    nodeCoordinateMap: Map<string, PlannerNodeCoordinate>;
    transitDirectionCache: Map<string, Promise<AmapDirectionResult | null>>;
  }): Promise<AmapDirectionResult | null> {
    if (params.walkingMeters > 0 && params.walkingMeters <= 1200) {
      return null;
    }
    if (!this.amapTransitClient.isEnabled()) {
      return null;
    }

    const origin = params.nodeCoordinateMap.get(params.fromPointId);
    const destination = params.nodeCoordinateMap.get(params.toPointId);
    if (!origin || !destination) {
      return null;
    }

    const key = `${params.city.toLowerCase()}\u0000${params.fromPointId}\u0000${params.toPointId}`;
    if (!params.transitDirectionCache.has(key)) {
      const request = this.amapTransitClient
        .getDirection({
          mode: 'transit',
          origin: this.toAmapCoordinate(origin),
          destination: this.toAmapCoordinate(destination),
          city: params.city,
        })
        .catch(() => null);
      params.transitDirectionCache.set(key, request);
    }

    return (await params.transitDirectionCache.get(key)) ?? null;
  }

  private toAmapCoordinate(point: PlannerNodeCoordinate): AmapCoordinate {
    return {
      latitude: point.latitude,
      longitude: point.longitude,
    };
  }

  private resolveTransitEdge(
    edgeMap: Map<string, TransitCache>,
    fromPointId: string,
    toPointId: string,
  ): TransitCache {
    const direct = edgeMap.get(this.buildEdgeKey(fromPointId, toPointId));
    if (direct) {
      return direct;
    }

    const reverse = edgeMap.get(this.buildEdgeKey(toPointId, fromPointId));
    if (reverse) {
      return reverse;
    }

    return {
      id: '',
      city: '',
      province: null,
      fromPointId,
      fromPointType: 'spot',
      toPointId,
      toPointType: 'spot',
      transitMinutes: 30,
      drivingMinutes: 22,
      walkingMeters: 2500,
      transitSummary: null,
      transitSummaryI18n: null,
      distanceKm: 8,
      provider: 'fallback',
      status: 'failed',
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private chooseTransportMode(
    edge: Pick<TransitCache, 'transitMinutes' | 'drivingMinutes' | 'walkingMeters'>,
    hasTransitDirection: boolean,
  ): 'transit' | 'driving' | 'walking' {
    if (edge.walkingMeters > 0 && edge.walkingMeters <= 1200) {
      return 'walking';
    }
    if (hasTransitDirection && edge.transitMinutes <= edge.drivingMinutes + 5) {
      return 'transit';
    }
    return 'driving';
  }

  private buildEdgeKey(fromPointId: string, toPointId: string): string {
    return `${fromPointId}\u0000${toPointId}`;
  }

  private addDaysToIsoDate(date: string, days: number): string {
    const seed = new Date(`${date}T12:00:00.000Z`);
    if (!Number.isFinite(seed.getTime())) {
      return date;
    }
    const next = new Date(seed.getTime() + days * 24 * 60 * 60 * 1000);
    return next.toISOString().slice(0, 10);
  }

  private buildReturnFlightDateTime(
    arrivalDateTime: string,
    tripDays: number,
  ): string | null {
    const seed = new Date(arrivalDateTime);
    if (!Number.isFinite(seed.getTime())) {
      return null;
    }
    const days = Math.max(1, tripDays);
    const target = new Date(seed.getTime() + days * 24 * 60 * 60 * 1000);
    return target.toISOString();
  }

  private mapSpotToPlannerPoint(
    spot: Spot,
    lang: PlannerLang,
  ): PlannerPointView {
    const nameI18n = ensureTextI18n(spot.nameI18n, spot.name);
    const provinceI18n = ensureRegionI18n(spot.provinceI18n, spot.province);
    const cityI18n = ensureRegionI18n(spot.cityI18n, spot.city);
    const introI18n = ensureIntroI18n(spot.introI18n);

    return {
      id: spot.id,
      pointType: 'spot',
      name: resolveName(nameI18n, lang),
      nameI18n,
      province: spot.province,
      provinceI18n,
      city: spot.city,
      cityI18n,
      intro: resolveIntro(introI18n, lang),
      introI18n,
      suggestedDurationMinutes: spot.suggestedDurationMinutes,
      latitude:
        typeof spot.entryLatitude === 'number' &&
        Number.isFinite(spot.entryLatitude)
          ? spot.entryLatitude
          : typeof spot.exitLatitude === 'number' &&
              Number.isFinite(spot.exitLatitude)
            ? spot.exitLatitude
          : null,
      longitude:
        typeof spot.entryLongitude === 'number' &&
        Number.isFinite(spot.entryLongitude)
          ? spot.entryLongitude
          : typeof spot.exitLongitude === 'number' &&
              Number.isFinite(spot.exitLongitude)
            ? spot.exitLongitude
          : null,
      coverImageUrl: spot.coverImageUrl,
    };
  }

  private mapShoppingToPlannerPoint(
    item: ShoppingPlace,
    lang: PlannerLang,
  ): PlannerPointView {
    const nameI18n = ensureTextI18n(item.nameI18n, item.name);
    const provinceI18n = ensureRegionI18n(item.provinceI18n, item.province);
    const cityI18n = ensureRegionI18n(item.cityI18n, item.city);
    const introI18n = ensureIntroI18n(item.introI18n);

    return {
      id: item.id,
      pointType: 'shopping',
      name: resolveName(nameI18n, lang),
      nameI18n,
      province: item.province,
      provinceI18n,
      city: item.city,
      cityI18n,
      intro: resolveIntro(introI18n, lang),
      introI18n,
      suggestedDurationMinutes: item.suggestedDurationMinutes,
      latitude:
        typeof item.latitude === 'number' && Number.isFinite(item.latitude)
          ? item.latitude
          : null,
      longitude:
        typeof item.longitude === 'number' && Number.isFinite(item.longitude)
          ? item.longitude
          : null,
      coverImageUrl: item.coverImageUrl,
    };
  }

  private mapRestaurantToPlannerPoint(
    item: RestaurantPlace,
    lang: PlannerLang,
  ): PlannerPointView {
    const nameI18n = ensureTextI18n(item.nameI18n, item.name);
    const provinceI18n = ensureRegionI18n(item.provinceI18n, item.province);
    const cityI18n = ensureRegionI18n(item.cityI18n, item.city);
    const introI18n = ensureIntroI18n(item.introI18n);

    return {
      id: item.id,
      pointType: 'restaurant',
      name: resolveName(nameI18n, lang),
      nameI18n,
      province: item.province,
      provinceI18n,
      city: item.city,
      cityI18n,
      intro: resolveIntro(introI18n, lang),
      introI18n,
      suggestedDurationMinutes: item.suggestedDurationMinutes,
      mealSlots: normalizeMealSlots(item.mealSlots),
      latitude:
        typeof item.latitude === 'number' && Number.isFinite(item.latitude)
          ? item.latitude
          : null,
      longitude:
        typeof item.longitude === 'number' && Number.isFinite(item.longitude)
          ? item.longitude
          : null,
      coverImageUrl: item.coverImageUrl,
    };
  }

  private mapHotelCandidate(hotel: HotelPlace): PlannerHotelCandidate {
    return {
      id: hotel.id,
      name: hotel.name,
      nameI18n: ensureTextI18n(hotel.nameI18n, hotel.name),
      province: hotel.province,
      city: hotel.city,
      starLevel:
        typeof hotel.starLevel === 'number' && Number.isFinite(hotel.starLevel)
          ? hotel.starLevel
          : null,
      foreignerFriendly: hotel.foreignerFriendly !== false,
      checkInTime: hotel.checkInTime?.trim() || null,
      checkOutTime: hotel.checkOutTime?.trim() || null,
      bookingUrl: hotel.bookingUrl?.trim() || null,
      pricePerNightMinCny: hotel.pricePerNightMinCny,
      pricePerNightMaxCny: hotel.pricePerNightMaxCny,
      latitude:
        typeof hotel.latitude === 'number' && Number.isFinite(hotel.latitude)
          ? hotel.latitude
          : null,
      longitude:
        typeof hotel.longitude === 'number' && Number.isFinite(hotel.longitude)
          ? hotel.longitude
          : null,
    };
  }

  private buildFlightLink(params: {
    direction: 'outbound' | 'return';
    city: string;
    province: string;
    dateTime: string | null;
  }): string {
    const url = new URL(this.config.tripFlightDeeplinkBaseUrl);
    const isoDateTime =
      params.dateTime && Number.isFinite(Date.parse(params.dateTime))
        ? new Date(params.dateTime).toISOString()
        : null;

    url.searchParams.set('tripType', 'OW');
    url.searchParams.set('direction', params.direction);
    url.searchParams.set('city', params.city);
    url.searchParams.set('province', params.province);
    url.searchParams.set('locale', this.config.tripDefaultLocale);
    url.searchParams.set('currency', this.config.tripDefaultCurrency);
    if (isoDateTime) {
      url.searchParams.set('dateTime', isoDateTime);
      url.searchParams.set('date', isoDateTime.slice(0, 10));
    }

    this.applyAffiliateParams(url);
    return url.toString();
  }

  private buildHotelLink(params: {
    city: string;
    province: string;
    checkInDate: string;
    checkOutDate: string;
  }): string {
    const url = new URL(this.config.tripHotelDeeplinkBaseUrl);
    url.searchParams.set('city', params.city);
    url.searchParams.set('province', params.province);
    url.searchParams.set('checkIn', params.checkInDate);
    url.searchParams.set('checkOut', params.checkOutDate);
    url.searchParams.set('locale', this.config.tripDefaultLocale);
    url.searchParams.set('currency', this.config.tripDefaultCurrency);

    this.applyAffiliateParams(url);
    return url.toString();
  }

  private applyAffiliateParams(url: URL): void {
    const aid = this.normalizeOptional(this.config.tripAffiliateAid);
    const sid = this.normalizeOptional(this.config.tripAffiliateSid);
    const ouid = this.normalizeOptional(this.config.tripAffiliateOuid);
    if (aid) {
      url.searchParams.set('aid', aid);
    }
    if (sid) {
      url.searchParams.set('sid', sid);
    }
    if (ouid) {
      url.searchParams.set('ouid', ouid);
    }
  }

  private assertPointWithinCity(
    pointType: 'spot' | 'shopping' | 'restaurant',
    pointId: string,
    pointCity: string,
    city: string,
  ): void {
    if (this.isSameText(pointCity, city)) {
      return;
    }
    throw new BadRequestException({
      code: 'TRIP_PLANNER_POINT_CITY_MISMATCH',
      message: `Selected ${pointType} point is not in the target city.`,
      details: {
        pointType,
        pointId,
        expectedCity: city,
        actualCity: pointCity,
      },
    });
  }

  private assertPointWithinProvince(
    pointType: 'spot' | 'shopping' | 'restaurant',
    pointId: string,
    pointProvince: string,
    province: string,
  ): void {
    if (this.isSameText(pointProvince, province)) {
      return;
    }
    throw new BadRequestException({
      code: 'TRIP_PLANNER_POINT_PROVINCE_MISMATCH',
      message: `Selected ${pointType} point is not in the target province.`,
      details: {
        pointType,
        pointId,
        expectedProvince: province,
        actualProvince: pointProvince,
      },
    });
  }

  private assertSolverReadySelectedPoints(points: GeneratedPlannerPoint[]): void {
    const invalid: Array<{
      id: string;
      pointType: 'spot' | 'shopping' | 'restaurant';
      reason: string;
    }> = [];

    for (const point of points) {
      if (!point.city.trim()) {
        invalid.push({
          id: point.id,
          pointType: point.pointType,
          reason: 'missing_city',
        });
        continue;
      }
      if (!point.province.trim()) {
        invalid.push({
          id: point.id,
          pointType: point.pointType,
          reason: 'missing_province',
        });
        continue;
      }
      if (
        !Number.isInteger(point.suggestedDurationMinutes) ||
        point.suggestedDurationMinutes <= 0
      ) {
        invalid.push({
          id: point.id,
          pointType: point.pointType,
          reason: 'missing_duration',
        });
        continue;
      }
      if (
        typeof point.latitude !== 'number' ||
        !Number.isFinite(point.latitude) ||
        typeof point.longitude !== 'number' ||
        !Number.isFinite(point.longitude)
      ) {
        invalid.push({
          id: point.id,
          pointType: point.pointType,
          reason: 'missing_coordinate',
        });
      }
    }

    if (invalid.length > 0) {
      throw new BadRequestException({
        code: 'TRIP_PLANNER_POINTS_NOT_SOLVER_READY',
        message:
          'Some selected points are missing required fields for solver input.',
        details: {
          invalid,
        },
      });
    }
  }

  private assertSolverReadyHotels(hotels: PlannerHotelCandidate[]): void {
    const invalid = hotels
      .filter(
        (item) =>
          !item.city.trim() ||
          !item.province.trim() ||
          typeof item.latitude !== 'number' ||
          !Number.isFinite(item.latitude) ||
          typeof item.longitude !== 'number' ||
          !Number.isFinite(item.longitude),
      )
      .map((item) => ({
        id: item.id,
        reason:
          typeof item.latitude !== 'number' ||
          !Number.isFinite(item.latitude) ||
          typeof item.longitude !== 'number' ||
          !Number.isFinite(item.longitude)
            ? 'missing_coordinate'
            : !item.city.trim()
              ? 'missing_city'
              : 'missing_province',
      }));

    if (invalid.length === hotels.length) {
      throw new BadRequestException({
        code: 'TRIP_PLANNER_HOTELS_NOT_SOLVER_READY',
        message:
          'No published hotels with complete coordinates and city/province are available for solver input.',
        details: {
          invalid,
        },
      });
    }
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: 'TRIP_PLANNER_HOTELS_NOT_SOLVER_READY',
        message:
          'Some published hotels are missing required fields for solver input.',
        details: {
          invalid,
        },
      });
    }
  }

  private assertSolverReadyAirport(
    airport: LocationAirport | null,
    field: 'arrivalAirportCode' | 'departureAirportCode',
  ): void {
    if (!airport) {
      return;
    }
    if (
      typeof airport.latitude === 'number' &&
      Number.isFinite(airport.latitude) &&
      typeof airport.longitude === 'number' &&
      Number.isFinite(airport.longitude)
    ) {
      return;
    }
    throw new BadRequestException({
      code: 'TRIP_PLANNER_AIRPORT_NOT_SOLVER_READY',
      message: `${field} airport is missing coordinates.`,
      details: {
        field,
        airportCode: airport.airportCode,
        airportId: airport.id,
      },
    });
  }

  private inferSingleProvince(provinces: string[]): string | null {
    const normalized = provinces
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (normalized.length === 0) {
      return null;
    }

    const map = new Map<string, string>();
    for (const item of normalized) {
      const key = item.toLowerCase();
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    if (map.size !== 1) {
      return null;
    }
    const iterator = map.values();
    const first = iterator.next();
    return first.done ? null : first.value;
  }

  private resolveLang(input?: string | null): ContentLang {
    if (input === 'zh-CN' || input === 'en-US' || input === 'mn-MN') {
      return input;
    }
    return 'zh-CN';
  }

  private normalizeRequired(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException({
        code: 'TRIP_PLANNER_FIELD_REQUIRED',
        message: `${field} is required.`,
      });
    }
    return normalized;
  }

  private normalizeOptional(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private isSameText(left: string, right: string): boolean {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }
}

function normalizeMealSlots(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const normalized = input.filter(
    (item): item is string =>
      typeof item === 'string' && RESTAURANT_MEAL_SLOTS.has(item),
  );
  return Array.from(new Set(normalized));
}
