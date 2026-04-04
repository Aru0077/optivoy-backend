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
import {
  latestClosingTime,
  normalizeOpeningHours,
  normalizeQueueProfile,
  normalizeSpecialDates,
  type OpeningHoursRule,
  type QueueProfile,
} from '../../common/utils/planning-metadata.util';
import { PlannerConfig } from '../../config/planner.config';
import { HotelPlace } from '../hotels/entities/hotel.entity';
import { LocationAirport } from '../locations/entities/location-airport.entity';
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
  OptimizerRequestError,
  OptimizerSolveResponse,
} from './optimizer.client';
import { TripPlannerCacheService } from './trip-planner-cache.service';
import {
  GeneratedTripPoint,
  GeneratedTripResult,
  GeneratedTripSequenceItem,
  GeneratedTripHotelStop,
  HotelBookingLink,
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
  pointType: 'spot' | 'shopping';
  name: string;
  suggestedDurationMinutes: number;
  guideI18n: Record<string, string | undefined>;
  coverImageUrl: string | null;
  city: string;
  province: string;
  arrivalAnchorLatitude: number | null;
  arrivalAnchorLongitude: number | null;
  departureAnchorLatitude: number | null;
  departureAnchorLongitude: number | null;
  latitude: number | null;
  longitude: number | null;
  openingHoursJson: OpeningHoursRule[];
  specialClosureDates: string[];
  lastEntryTime: string | null;
  reservationRequired: boolean;
  queueProfileJson: QueueProfile | null;
  hasFoodCourt: boolean;
}

interface ResolvedHotelBookingSegment extends HotelBookingLink {
  itineraryStartDate: string;
  itineraryEndDate: string;
}

interface OptimizerDayDiagnosticsView {
  lunchBreakMinutes?: number;
  lunchBreakBeforePointId?: string | null;
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
  allNodeIds: string[];
  cacheEdges: TransitCache[];
  matrixRows: OptimizerDistanceMatrixRow[];
}

const WALKING_PRIORITY_METERS = 1500;

@Injectable()
export class TripPlannerService {
  private readonly config: PlannerConfig;

  constructor(
    @InjectRepository(Spot)
    private readonly spotRepository: Repository<Spot>,
    @InjectRepository(ShoppingPlace)
    private readonly shoppingRepository: Repository<ShoppingPlace>,
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
      const [spotGroups, shoppingGroups] = await Promise.all([
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
      ]);

      const merged = new Map<string, TripCityItem>();
      const mergeItem = (
        province: string,
        city: string,
        spotsCount: number,
        shoppingCount: number,
      ) => {
        const key = `${province}\u0000${city}`;
        const current = merged.get(key);
        if (!current) {
          merged.set(key, {
            province,
            city,
            spotsCount,
            shoppingCount,
          });
          return;
        }
        current.spotsCount += spotsCount;
        current.shoppingCount += shoppingCount;
      };

      for (const row of spotGroups) {
        mergeItem(
          row.province.trim(),
          row.city.trim(),
          parseInt(row.count ?? '0', 10),
          0,
        );
      }
      for (const row of shoppingGroups) {
        mergeItem(
          row.province.trim(),
          row.city.trim(),
          0,
          parseInt(row.count ?? '0', 10),
        );
      }

      const ordered = Array.from(merged.values()).sort((a, b) => {
        const aTotal = a.spotsCount + a.shoppingCount;
        const bTotal = b.spotsCount + b.shoppingCount;
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
    items: PlannerPointView[];
    outboundFlight: string;
  }> {
    const city = this.normalizeRequired(cityParam, 'city');
    const province = this.normalizeOptional(query.province);
    const lang = this.resolveLang(query.lang);
    const cacheKey = `trip-city-points:${city.toLowerCase()}:${(province ?? '').toLowerCase()}:${lang}`;

    return this.tripPlannerCacheService.remember(cacheKey, async () => {
      const [spots, shopping] = await Promise.all([
        this.querySpotsByCity(city, province),
        this.queryShoppingByCity(city, province),
      ]);

      const mappedSpots = spots.map((item) =>
        this.mapSpotToPlannerPoint(item, lang),
      );
      const mappedShopping = shopping.map((item) =>
        this.mapShoppingToPlannerPoint(item, lang),
      );
      const items = [...mappedSpots, ...mappedShopping].sort((a, b) => {
        if (a.pointType !== b.pointType) {
          return a.pointType.localeCompare(b.pointType);
        }
        return a.name.localeCompare(b.name);
      });

      const resolvedProvince =
        province ??
        this.inferSingleProvince(items.map((item) => item.province));
      const airportCode = await this.resolveCityAirportCode(
        city,
        resolvedProvince ?? null,
      );

      return {
        city,
        province: resolvedProvince,
        total: items.length,
        spotsCount: mappedSpots.length,
        shoppingCount: mappedShopping.length,
        items,
        outboundFlight: this.buildFlightLink('UBN', airportCode),
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
    const cacheEdges = context.cacheEdges;
    const matrixRows = context.matrixRows;
    const cityAirportCode = await this.resolveCityAirportCode(
      city,
      resolvedProvince,
    );

    let solverResult: OptimizerSolveResponse;
    try {
      solverResult = await this.optimizerClient.solve({
        city,
        province: resolvedProvince,
        startDate: dto.startDate,
        paceMode: dto.paceMode,
        hotelStrategy: dto.hotelStrategy,
        mealPolicy: dto.mealPolicy ?? 'auto',
        points: selectedPoints.map((item) => ({
          id: item.id,
          pointType: item.pointType,
          suggestedDurationMinutes: item.suggestedDurationMinutes,
          latitude: item.latitude,
          longitude: item.longitude,
          arrivalAnchor: this.toOptimizerCoordinate(
            item.arrivalAnchorLatitude,
            item.arrivalAnchorLongitude,
          ),
          departureAnchor: this.toOptimizerCoordinate(
            item.departureAnchorLatitude,
            item.departureAnchorLongitude,
          ),
          openingHoursJson: item.openingHoursJson,
          specialClosureDates: item.specialClosureDates,
          lastEntryTime: item.lastEntryTime,
          hasFoodCourt: item.hasFoodCourt,
          queueProfileJson: item.queueProfileJson,
        })),
        hotels: hotelCandidates.map((item) => ({
          id: item.id,
          latitude: item.latitude,
          longitude: item.longitude,
          arrivalAnchor: this.toOptimizerCoordinate(
            item.arrivalAnchorLatitude,
            item.arrivalAnchorLongitude,
          ),
          departureAnchor: this.toOptimizerCoordinate(
            item.departureAnchorLatitude,
            item.departureAnchorLongitude,
          ),
          checkInTime: item.checkInTime,
          checkOutTime: item.checkOutTime,
        })),
        distanceMatrix: {
          rows: matrixRows,
        },
        transportPreference: 'mixed',
        maxIntradayDrivingMinutes: 120,
      });
    } catch (error) {
      if (error instanceof OptimizerRequestError && error.status === 400) {
        throw new BadRequestException({
          code: 'TRIP_PLANNER_NO_FEASIBLE_ITINERARY',
          message:
            'No feasible itinerary could be generated for the selected points and constraints.',
          details: this.extractOptimizerBadRequestDetails(error),
        });
      }
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
    });
    const transitDirectionCache = new Map<string, Promise<AmapDirectionResult | null>>();
    const endDate = this.computeEndDate(dto.startDate, solverResult.tripDays);
    const hotelBookingSegments = this.buildHotelBookingSegments(
      solverResult.days,
      hotelCandidates,
      dto.startDate,
      city,
      resolvedProvince,
    );
    const hotelBookingLinks = this.buildHotelBookingLinks(hotelBookingSegments);
    const optimizerDayDiagnostics = this.buildOptimizerDayDiagnosticsMap(
      solverResult.diagnostics,
    );
    const days = await this.buildGeneratedDays({
      city,
      province: resolvedProvince,
      days: solverResult.days,
      pointById,
      hotelById,
      hotelBookingSegments,
      optimizerDayDiagnostics,
      edgeMap,
      nodeCoordinateMap,
      transitDirectionCache,
    });

    return {
      city,
      province: resolvedProvince,
      startDate: dto.startDate,
      endDate,
      tripDays: solverResult.tripDays,
      solverStatus: solverResult.solverStatus,
      days,
      hotelBookingLinks,
      links: {
        outboundFlight: this.buildFlightLink('UBN', cityAirportCode),
        returnFlight: this.buildFlightLink(cityAirportCode, 'UBN'),
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

    return {
      city: context.city,
      province: context.province,
      nodeCount,
      pointCount: context.selectedPoints.length,
      hotelCount: context.hotelCandidates.length,
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

    const [spots, shopping] = await Promise.all([
      this.querySpotsByIds(selectedPointIds),
      this.queryShoppingByIds(selectedPointIds),
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
    if (hotelCandidates.length === 0) {
      throw new NotFoundException({
        code: 'TRIP_PLANNER_HOTELS_NOT_AVAILABLE',
        message:
          'No published hotels with valid planning candidates found in target city.',
      });
    }
    this.assertSolverReadyHotels(hotelCandidates);

    const allNodeIds = [
      ...selectedPoints.map((item) => item.id),
      ...hotelCandidates.map((item) => item.id),
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

  private async resolveCityAirportCode(
    city: string,
    province: string | null,
  ): Promise<string> {
    const airportQb = this.airportRepository
      .createQueryBuilder('airport')
      .leftJoinAndSelect('airport.city', 'city')
      .leftJoinAndSelect('city.province', 'province')
      .where('LOWER(city.name) = LOWER(:city)', { city })
      .orderBy('airport."airportCode"', 'ASC');

    if (province) {
      airportQb.andWhere('LOWER(province.name) = LOWER(:province)', {
        province,
      });
    }

    const airport = await airportQb.getOne();

    if (!airport?.airportCode?.trim()) {
      throw new NotFoundException({
        code: 'TRIP_PLANNER_CITY_AIRPORT_NOT_FOUND',
        message: 'No airport code is configured for the target city.',
        details: {
          city,
          province,
        },
      });
    }

    return airport.airportCode.trim().toUpperCase();
  }

  private mapSpotToGeneratedPlannerPoint(spot: Spot): GeneratedPlannerPoint {
    const arrivalCoordinate = this.resolveSpotArrivalCoordinate(spot);
    const departureCoordinate = this.resolveSpotDepartureCoordinate(spot);
    const openingHoursJson = this.resolveSpotOpeningHoursForSolver(spot);
    return {
      id: spot.id,
      pointType: 'spot',
      name: ensureTextI18n(spot.nameI18n, spot.name)['zh-CN'],
      suggestedDurationMinutes: spot.suggestedDurationMinutes,
      guideI18n: ensureGuideI18n(spot.guideI18n),
      coverImageUrl: spot.coverImageUrl,
      city: spot.city,
      province: spot.province,
      arrivalAnchorLatitude: arrivalCoordinate?.latitude ?? null,
      arrivalAnchorLongitude: arrivalCoordinate?.longitude ?? null,
      departureAnchorLatitude: departureCoordinate?.latitude ?? null,
      departureAnchorLongitude: departureCoordinate?.longitude ?? null,
      latitude: arrivalCoordinate?.latitude ?? departureCoordinate?.latitude ?? null,
      longitude:
        arrivalCoordinate?.longitude ?? departureCoordinate?.longitude ?? null,
      openingHoursJson,
      specialClosureDates: normalizeSpecialDates(spot.specialClosureDates),
      lastEntryTime: this.resolveSpotLastEntryTimeForSolver(
        spot,
        openingHoursJson,
      ),
      reservationRequired: spot.reservationRequired === true,
      queueProfileJson: normalizeQueueProfile(spot.queueProfileJson),
      hasFoodCourt: spot.hasFoodCourt === true,
    };
  }

  private mapShoppingToGeneratedPlannerPoint(
    item: ShoppingPlace,
  ): GeneratedPlannerPoint {
    const arrivalCoordinate = this.resolveCoordinatePair(
      item.arrivalAnchorLatitude,
      item.arrivalAnchorLongitude,
    );
    const departureCoordinate = this.resolveCoordinatePair(
      item.departureAnchorLatitude,
      item.departureAnchorLongitude,
    );
    const fallbackCoordinate = this.resolveCoordinatePair(
      item.latitude,
      item.longitude,
    );
    const openingHoursJson = this.resolveShoppingOpeningHoursForSolver(item);
    return {
      id: item.id,
      pointType: 'shopping',
      name: ensureTextI18n(item.nameI18n, item.name)['zh-CN'],
      suggestedDurationMinutes: item.suggestedDurationMinutes,
      guideI18n: ensureGuideI18n(item.guideI18n),
      coverImageUrl: item.coverImageUrl,
      city: item.city,
      province: item.province,
      arrivalAnchorLatitude:
        arrivalCoordinate?.latitude ?? fallbackCoordinate?.latitude ?? null,
      arrivalAnchorLongitude:
        arrivalCoordinate?.longitude ?? fallbackCoordinate?.longitude ?? null,
      departureAnchorLatitude:
        departureCoordinate?.latitude ?? fallbackCoordinate?.latitude ?? null,
      departureAnchorLongitude:
        departureCoordinate?.longitude ?? fallbackCoordinate?.longitude ?? null,
      latitude:
        arrivalCoordinate?.latitude ??
        departureCoordinate?.latitude ??
        fallbackCoordinate?.latitude ??
        null,
      longitude:
        arrivalCoordinate?.longitude ??
        departureCoordinate?.longitude ??
        fallbackCoordinate?.longitude ??
        null,
      openingHoursJson,
      specialClosureDates: normalizeSpecialDates(item.specialClosureDates),
      lastEntryTime: null,
      reservationRequired: false,
      queueProfileJson: null,
      hasFoodCourt: item.hasFoodCourt === true,
    };
  }

  private resolveSpotArrivalCoordinate(
    spot: Spot,
  ): PlannerNodeCoordinate | null {
    return this.resolveCoordinatePair(spot.entryLatitude, spot.entryLongitude)
      ?? this.resolveCoordinatePair(spot.exitLatitude, spot.exitLongitude);
  }

  private resolveSpotDepartureCoordinate(
    spot: Spot,
  ): PlannerNodeCoordinate | null {
    return this.resolveCoordinatePair(spot.exitLatitude, spot.exitLongitude)
      ?? this.resolveCoordinatePair(spot.entryLatitude, spot.entryLongitude);
  }

  private resolveCoordinatePair(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ): PlannerNodeCoordinate | null {
    if (
      typeof latitude === 'number' &&
      Number.isFinite(latitude) &&
      typeof longitude === 'number' &&
      Number.isFinite(longitude)
    ) {
      return { latitude, longitude };
    }
    return null;
  }

  private toOptimizerCoordinate(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ): { latitude: number | null; longitude: number | null } | undefined {
    const coordinate = this.resolveCoordinatePair(latitude, longitude);
    if (!coordinate) {
      return undefined;
    }
    return coordinate;
  }

  private mapTransitEdgeToMatrixRow(edge: TransitCache): OptimizerDistanceMatrixRow {
    return {
      fromPointId: edge.fromPointId,
      toPointId: edge.toPointId,
      transitMinutes: edge.transitMinutes,
      drivingMinutes: edge.drivingMinutes,
      walkingMeters: edge.walkingMeters,
      walkingMinutes: edge.walkingMinutes ?? null,
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
  }): Map<string, PlannerNodeCoordinate> {
    const map = new Map<string, PlannerNodeCoordinate>();

    for (const point of params.points) {
      const coordinate = this.resolveCoordinatePair(
        point.arrivalAnchorLatitude ?? point.latitude,
        point.arrivalAnchorLongitude ?? point.longitude,
      );
      if (coordinate) {
        map.set(point.id, {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        });
      }
    }

    for (const hotel of params.hotels) {
      const coordinate = this.resolveCoordinatePair(
        hotel.arrivalAnchorLatitude ?? hotel.latitude,
        hotel.arrivalAnchorLongitude ?? hotel.longitude,
      );
      if (coordinate) {
        map.set(hotel.id, {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
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
    hotelBookingSegments: ResolvedHotelBookingSegment[];
    optimizerDayDiagnostics: Map<number, OptimizerDayDiagnosticsView>;
    edgeMap: Map<string, TransitCache>;
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
        edgeMap: params.edgeMap,
        nodeCoordinateMap: params.nodeCoordinateMap,
        transitDirectionCache: params.transitDirectionCache,
      });
      const bookingLink = this.resolveDayHotelBookingLink(
        params.hotelBookingSegments,
        day.hotelId,
        day.date,
      );
      const startHotelBookingLink = this.resolveDayStartHotelBookingLink(
        params.hotelBookingSegments,
        previousHotelId,
        day.hotelId,
        day.date,
      );

      const pointViews = day.pointIds.map((pointId) => {
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
          coverImageUrl: point.coverImageUrl,
          hasFoodCourt: point.hasFoodCourt,
          lunchIncluded: false,
          lunchNote: null,
        };
      });
      const lunchArrangement = this.buildLunchArrangement(pointViews);
      const sequence = this.buildDaySequence({
        startHotel: {
          id: startHotelBookingLink.hotelId,
          name:
            params.hotelById.get(startHotelBookingLink.hotelId)?.name ??
            startHotelBookingLink.hotelName,
          checkInDate: startHotelBookingLink.checkInDate,
          checkOutDate: startHotelBookingLink.checkOutDate,
        },
        endHotel: {
          id: hotel.id,
          name: hotel.name,
          checkInDate: bookingLink.checkInDate,
          checkOutDate: bookingLink.checkOutDate,
        },
        legs,
        points: lunchArrangement.points,
        lunchBreak: lunchArrangement.lunchBreak,
        lunchBreakBeforePointId:
          params.optimizerDayDiagnostics.get(day.dayNumber)?.lunchBreakBeforePointId ??
          null,
      });

      result.push({
        dayNumber: day.dayNumber,
        date: day.date,
        hotel: {
          id: hotel.id,
          name: hotel.name,
          checkInDate: bookingLink.checkInDate,
          checkOutDate: bookingLink.checkOutDate,
        },
        sequence,
        lunchBreak: lunchArrangement.lunchBreak,
        legs,
        points: lunchArrangement.points,
      });
    }

    return result;
  }

  private async buildGeneratedLegs(params: {
    city: string;
    dayPointIds: string[];
    currentHotelId: string;
    previousHotelId: string | null;
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

    if (params.previousHotelId) {
      legPairs.push({
        fromPointId: params.previousHotelId,
        toPointId: firstPointId,
      });
    } else {
      legPairs.push({
        fromPointId: params.currentHotelId,
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
          (transitDirection?.durationMinutes !== null &&
            transitDirection?.durationMinutes !== undefined) ||
            edge.transitProviderStatus === 'ready',
        ),
        transitMinutes,
        drivingMinutes: edge.drivingMinutes,
        walkingMeters: edge.walkingMeters,
        distanceKm: edge.distanceKm,
        transitSummary: transitDirection?.summary ?? edge.transitSummary ?? null,
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
    if (
      params.walkingMeters > 0 &&
      params.walkingMeters <= WALKING_PRIORITY_METERS
    ) {
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
      walkingMinutes: 30,
      transitSummary: null,
      transitSummaryI18n: null,
      transitProviderStatus: 'fallback',
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
    if (
      edge.walkingMeters > 0 &&
      edge.walkingMeters <= WALKING_PRIORITY_METERS
    ) {
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

  private mapSpotToPlannerPoint(
    spot: Spot,
    lang: PlannerLang,
  ): PlannerPointView {
    const nameI18n = ensureTextI18n(spot.nameI18n, spot.name);
    const provinceI18n = ensureRegionI18n(spot.provinceI18n, spot.province);
    const cityI18n = ensureRegionI18n(spot.cityI18n, spot.city);
    const introI18n = ensureIntroI18n(spot.introI18n);
    const openingHoursJson = this.resolveSpotOpeningHoursForSolver(spot);

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
      openingHoursJson,
      specialClosureDates: normalizeSpecialDates(spot.specialClosureDates),
      lastEntryTime: this.resolveSpotLastEntryTimeForSolver(
        spot,
        openingHoursJson,
      ),
      reservationRequired: spot.reservationRequired === true,
      queueProfileJson: normalizeQueueProfile(spot.queueProfileJson),
      hasFoodCourt: spot.hasFoodCourt === true,
      arrivalAnchorLatitude:
        this.resolveSpotArrivalCoordinate(spot)?.latitude ?? null,
      arrivalAnchorLongitude:
        this.resolveSpotArrivalCoordinate(spot)?.longitude ?? null,
      departureAnchorLatitude:
        this.resolveSpotDepartureCoordinate(spot)?.latitude ?? null,
      departureAnchorLongitude:
        this.resolveSpotDepartureCoordinate(spot)?.longitude ?? null,
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
    const openingHoursJson = this.resolveShoppingOpeningHoursForSolver(item);

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
      openingHoursJson,
      specialClosureDates: normalizeSpecialDates(item.specialClosureDates),
      hasFoodCourt: item.hasFoodCourt === true,
      arrivalAnchorLatitude: item.arrivalAnchorLatitude,
      arrivalAnchorLongitude: item.arrivalAnchorLongitude,
      departureAnchorLatitude: item.departureAnchorLatitude,
      departureAnchorLongitude: item.departureAnchorLongitude,
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
    const primaryCoordinate =
      this.resolveCoordinatePair(
        hotel.arrivalAnchorLatitude,
        hotel.arrivalAnchorLongitude,
      ) ??
      this.resolveCoordinatePair(
        hotel.departureAnchorLatitude,
        hotel.departureAnchorLongitude,
      ) ??
      this.resolveCoordinatePair(hotel.latitude, hotel.longitude);
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
      arrivalAnchorLatitude: hotel.arrivalAnchorLatitude ?? null,
      arrivalAnchorLongitude: hotel.arrivalAnchorLongitude ?? null,
      departureAnchorLatitude: hotel.departureAnchorLatitude ?? null,
      departureAnchorLongitude: hotel.departureAnchorLongitude ?? null,
      checkInTime: hotel.checkInTime?.trim() || null,
      checkOutTime: hotel.checkOutTime?.trim() || null,
      bookingUrl: hotel.bookingUrl?.trim() || null,
      pricePerNightMinCny: hotel.pricePerNightMinCny,
      pricePerNightMaxCny: hotel.pricePerNightMaxCny,
      latitude: primaryCoordinate?.latitude ?? null,
      longitude: primaryCoordinate?.longitude ?? null,
    };
  }

  private buildUniformOpeningHours(
    start: string,
    end: string,
  ): OpeningHoursRule[] {
    return [1, 2, 3, 4, 5, 6, 0]
      .map((weekday) => ({
        weekday,
        periods: [{ start, end }],
      }));
  }

  private extractOptimizerBadRequestDetails(
    error: OptimizerRequestError,
  ): Record<string, unknown> {
    const responseBody =
      error.responseBody && typeof error.responseBody === 'object'
        ? (error.responseBody as Record<string, unknown>)
        : null;
    const detail =
      responseBody && 'detail' in responseBody
        ? responseBody.detail
        : error.bodyText;

    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      return {
        optimizer: detail,
      };
    }

    return {
      optimizer: {
        reason:
          typeof detail === 'string' && detail.trim().length > 0
            ? detail.trim()
            : error.message,
      },
    };
  }

  private resolveSpotOpeningHoursForSolver(spot: Spot): OpeningHoursRule[] {
    const normalized = normalizeOpeningHours(spot.openingHoursJson);
    if (normalized.length > 0) {
      return normalized;
    }
    return this.buildUniformOpeningHours('09:00', '18:00');
  }

  private resolveSpotLastEntryTimeForSolver(
    spot: Spot,
    openingHoursJson: OpeningHoursRule[],
  ): string | null {
    const explicit = spot.lastEntryTime?.trim() || null;
    if (explicit) {
      return explicit;
    }
    const latestClose = latestClosingTime(openingHoursJson);
    if (!latestClose) {
      return null;
    }
    const [hours, minutes] = latestClose.split(':').map((item) => Number(item));
    const totalMinutes = hours * 60 + minutes;
    const fallbackMinutes = Math.max(0, totalMinutes - 60);
    const fallbackHour = Math.floor(fallbackMinutes / 60)
      .toString()
      .padStart(2, '0');
    const fallbackMinute = (fallbackMinutes % 60).toString().padStart(2, '0');
    return `${fallbackHour}:${fallbackMinute}`;
  }

  private resolveShoppingOpeningHoursForSolver(
    item: ShoppingPlace,
  ): OpeningHoursRule[] {
    const normalized = normalizeOpeningHours(item.openingHoursJson);
    if (normalized.length > 0) {
      return normalized;
    }
    return this.buildUniformOpeningHours('10:00', '22:00');
  }

  private buildFlightLink(
    fromAirportCode: string,
    toAirportCode: string,
  ): string {
    const url = new URL(this.config.tripFlightDeeplinkBaseUrl);
    url.searchParams.set('tripType', 'OW');
    url.searchParams.set('fromAirportCode', fromAirportCode);
    url.searchParams.set('toAirportCode', toAirportCode);
    url.searchParams.set('locale', this.config.tripDefaultLocale);
    url.searchParams.set('currency', this.config.tripDefaultCurrency);

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

  private computeEndDate(startDate: string, tripDays: number): string {
    return this.addDaysToIsoDate(startDate, Math.max(0, tripDays - 1));
  }

  private buildHotelBookingSegments(
    days: OptimizerSolveResponse['days'],
    hotelCandidates: PlannerHotelCandidate[],
    startDate: string,
    city: string,
    province: string,
  ): ResolvedHotelBookingSegment[] {
    if (days.length === 0) {
      return [];
    }

    const hotelById = new Map(hotelCandidates.map((item) => [item.id, item] as const));
    const segments: Array<{
      hotelId: string;
      startDate: string;
      endDate: string;
      isFirst: boolean;
    }> = [];

    let segmentStartIndex = 0;
    for (let index = 1; index <= days.length; index += 1) {
      const segmentClosed =
        index === days.length || days[index]?.hotelId !== days[segmentStartIndex]?.hotelId;
      if (!segmentClosed) {
        continue;
      }

      segments.push({
        hotelId: days[segmentStartIndex].hotelId,
        startDate: days[segmentStartIndex].date,
        endDate: days[index - 1].date,
        isFirst: segmentStartIndex === 0,
      });
      segmentStartIndex = index;
    }

    return segments.map((segment) => {
      const hotel = hotelById.get(segment.hotelId);
      if (!hotel) {
        throw new ServiceUnavailableException({
          code: 'TRIP_PLANNER_INVALID_SOLVER_OUTPUT',
          message: `Optimizer returned unknown hotelId=${segment.hotelId} for booking segment.`,
        });
      }

      const checkInDate = segment.isFirst
        ? this.addDaysToIsoDate(startDate, -1)
        : segment.startDate;
      const checkOutDate = this.addDaysToIsoDate(segment.endDate, 1);
      const nights = Math.max(
        1,
        Math.round(
          (Date.parse(`${checkOutDate}T00:00:00.000Z`) -
            Date.parse(`${checkInDate}T00:00:00.000Z`)) /
            (24 * 60 * 60 * 1000),
        ),
      );

      return {
        itineraryStartDate: segment.startDate,
        itineraryEndDate: segment.endDate,
        hotelId: hotel.id,
        hotelName: hotel.name,
        checkInDate,
        checkOutDate,
        nights,
        bookingUrl:
          hotel.bookingUrl ??
          this.buildHotelLink({
            city,
            province,
            checkInDate,
            checkOutDate,
          }),
      };
    });
  }

  private buildHotelBookingLinks(
    segments: ResolvedHotelBookingSegment[],
  ): HotelBookingLink[] {
    return segments.map((item) => ({
      hotelId: item.hotelId,
      hotelName: item.hotelName,
      checkInDate: item.checkInDate,
      checkOutDate: item.checkOutDate,
      nights: item.nights,
      bookingUrl: item.bookingUrl,
    }));
  }

  private resolveDayHotelBookingLink(
    hotelBookingLinks: ResolvedHotelBookingSegment[],
    hotelId: string,
    dayDate: string,
  ): ResolvedHotelBookingSegment {
    const match = hotelBookingLinks.find((item) => {
      if (item.hotelId !== hotelId) {
        return false;
      }
      return dayDate >= item.itineraryStartDate && dayDate <= item.itineraryEndDate;
    });

    if (!match) {
      throw new ServiceUnavailableException({
        code: 'TRIP_PLANNER_INVALID_SOLVER_OUTPUT',
        message: `Unable to resolve hotel booking segment for hotelId=${hotelId} date=${dayDate}.`,
      });
    }

    return match;
  }

  private resolveDayStartHotelBookingLink(
    hotelBookingLinks: ResolvedHotelBookingSegment[],
    previousHotelId: string | null,
    currentHotelId: string,
    dayDate: string,
  ): ResolvedHotelBookingSegment {
    if (!previousHotelId || previousHotelId === currentHotelId) {
      return this.resolveDayHotelBookingLink(
        hotelBookingLinks,
        currentHotelId,
        dayDate,
      );
    }

    const previousSegment = hotelBookingLinks.find(
      (item) => item.hotelId === previousHotelId && item.checkOutDate === dayDate,
    );
    if (previousSegment) {
      return previousSegment;
    }

    return this.resolveDayHotelBookingLink(
      hotelBookingLinks,
      currentHotelId,
      dayDate,
    );
  }

  private buildLunchArrangement(
    points: GeneratedTripPoint[],
  ): {
    points: GeneratedTripPoint[];
    lunchBreak: { durationMinutes: number; note: string } | null;
  } {
    if (points.length === 0) {
      return {
        points,
        lunchBreak: null,
      };
    }

    const pointWithFoodCourtIndex = points.findIndex((item) => item.hasFoodCourt === true);
    if (pointWithFoodCourtIndex >= 0) {
      return {
        points: points.map((item, index) => ({
          ...item,
          lunchIncluded: index === pointWithFoodCourtIndex,
          lunchNote: index === pointWithFoodCourtIndex ? '含午餐时间' : null,
        })),
        lunchBreak: null,
      };
    }

    const allLongStay = points.every(
      (item) => item.suggestedDurationMinutes >= 240,
    );
    if (allLongStay) {
      return {
        points: points.map((item, index) => ({
          ...item,
          lunchIncluded: index === 0,
          lunchNote: index === 0 ? '含午餐时间' : null,
        })),
        lunchBreak: null,
      };
    }

    return {
      points,
      lunchBreak: {
        durationMinutes: 45,
        note: '附近自行安排',
      },
    };
  }

  private buildDaySequence(params: {
    startHotel: GeneratedTripHotelStop;
    endHotel: GeneratedTripHotelStop;
    legs: GeneratedTripResult['days'][number]['legs'];
    points: GeneratedTripPoint[];
    lunchBreak: { durationMinutes: number; note: string } | null;
    lunchBreakBeforePointId: string | null;
  }): GeneratedTripSequenceItem[] {
    const sequence: GeneratedTripSequenceItem[] = [
      {
        itemType: 'hotel',
        phase: 'start',
        hotel: params.startHotel,
      },
    ];

    let lunchInserted = false;
    for (let index = 0; index < params.points.length; index += 1) {
      const transport = params.legs[index];
      if (transport) {
        sequence.push({
          itemType: 'transport',
          ...transport,
        });
      }

      const point = params.points[index];
      if (
        !lunchInserted &&
        params.lunchBreak &&
        params.lunchBreakBeforePointId &&
        params.lunchBreakBeforePointId === point.id
      ) {
        sequence.push({
          itemType: 'lunch_break',
          durationMinutes: params.lunchBreak.durationMinutes,
          note: params.lunchBreak.note,
        });
        lunchInserted = true;
      }

      sequence.push({
        itemType: 'point',
        ...point,
      });

      if (
        !lunchInserted &&
        params.lunchBreak &&
        !params.lunchBreakBeforePointId &&
        index === Math.floor(params.points.length / 2)
      ) {
        sequence.push({
          itemType: 'lunch_break',
          durationMinutes: params.lunchBreak.durationMinutes,
          note: params.lunchBreak.note,
        });
        lunchInserted = true;
      }
    }

    const returnLeg = params.legs[params.points.length];
    if (returnLeg) {
      sequence.push({
        itemType: 'transport',
        ...returnLeg,
      });
    }

    sequence.push({
      itemType: 'hotel',
      phase: 'end',
      hotel: params.endHotel,
    });

    return sequence;
  }

  private buildOptimizerDayDiagnosticsMap(
    diagnostics: Record<string, unknown> | undefined,
  ): Map<number, OptimizerDayDiagnosticsView> {
    const map = new Map<number, OptimizerDayDiagnosticsView>();
    const days = Array.isArray(diagnostics?.days)
      ? (diagnostics.days as Array<Record<string, unknown>>)
      : [];

    for (const item of days) {
      const dayNumber = Number(item.dayNumber);
      if (!Number.isInteger(dayNumber) || dayNumber <= 0) {
        continue;
      }
      map.set(dayNumber, {
        lunchBreakMinutes:
          typeof item.lunchBreakMinutes === 'number'
            ? item.lunchBreakMinutes
            : undefined,
        lunchBreakBeforePointId:
          typeof item.lunchBreakBeforePointId === 'string'
            ? item.lunchBreakBeforePointId
            : null,
      });
    }

    return map;
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
    pointType: 'spot' | 'shopping',
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
    pointType: 'spot' | 'shopping',
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
      pointType: 'spot' | 'shopping';
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
        continue;
      }
      if (point.openingHoursJson.length === 0) {
        invalid.push({
          id: point.id,
          pointType: point.pointType,
          reason: 'missing_opening_hours',
        });
        continue;
      }
      if (point.pointType === 'spot' && !point.lastEntryTime) {
        invalid.push({
          id: point.id,
          pointType: point.pointType,
          reason: 'missing_last_entry_time',
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
    const invalid = hotels.flatMap((item) => {
      if (!item.city.trim()) {
        return [{ id: item.id, reason: 'missing_city' }];
      }
      if (!item.province.trim()) {
        return [{ id: item.id, reason: 'missing_province' }];
      }
      if (
        typeof item.latitude !== 'number' ||
        !Number.isFinite(item.latitude) ||
        typeof item.longitude !== 'number' ||
        !Number.isFinite(item.longitude)
      ) {
        return [{ id: item.id, reason: 'missing_coordinate' }];
      }
      if (!item.checkInTime) {
        return [{ id: item.id, reason: 'missing_check_in_time' }];
      }
      if (!item.checkOutTime) {
        return [{ id: item.id, reason: 'missing_check_out_time' }];
      }
      return [];
    });

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
