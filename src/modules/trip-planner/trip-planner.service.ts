import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ContentLang,
  resolveIntro,
  resolveName,
  toCyrillicApprox,
  toNullableNumber,
} from '../../common/utils/content-i18n.util';
import { PlannerConfig } from '../../config/planner.config';
import { HotelPlace } from '../hotels/entities/hotel.entity';
import { ShoppingPlace } from '../shopping/entities/shopping.entity';
import { Spot } from '../spots/entities/spot.entity';
import { GenerateItineraryDto } from './dto/generate-itinerary.dto';
import { ListCityPointsQueryDto } from './dto/list-city-points-query.dto';
import { ListTripCitiesQueryDto } from './dto/list-trip-cities-query.dto';
import { TripPlannerAiService } from './trip-planner-ai.service';
import {
  GeneratedTripResult,
  PlannerHotelCandidate,
  PlannerInputPoint,
  PlannerLang,
  PlannerPointView,
  TripCityItem,
} from './trip-planner.types';

interface GroupedCityRow {
  province: string;
  city: string;
  count: string;
}

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
    private readonly aiService: TripPlannerAiService,
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
        merged.set(key, { province, city, spotsCount, shoppingCount });
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
      province ?? this.inferSingleProvince(items.map((item) => item.province));

    return {
      city,
      province: resolvedProvince,
      total: items.length,
      spotsCount: mappedSpots.length,
      shoppingCount: mappedShopping.length,
      items,
      outboundFlight: this.buildFlightLink({
        direction: 'outbound',
        city,
        province: resolvedProvince ?? '',
        dateTime: null,
      }),
    };
  }

  async generateItinerary(
    dto: GenerateItineraryDto,
  ): Promise<GeneratedTripResult> {
    const city = this.normalizeRequired(dto.city, 'city');
    const provinceInput = this.normalizeOptional(dto.province);

    if (dto.selectedSpotIds.length + dto.selectedShoppingIds.length === 0) {
      throw new BadRequestException({
        code: 'TRIP_PLANNER_POINTS_REQUIRED',
        message: 'At least one spot or shopping point must be selected.',
      });
    }

    const [spots, shopping] = await Promise.all([
      dto.selectedSpotIds.length > 0
        ? this.spotRepository.findBy({
            id: In(dto.selectedSpotIds),
            isPublished: true,
          })
        : Promise.resolve([]),
      dto.selectedShoppingIds.length > 0
        ? this.shoppingRepository.findBy({
            id: In(dto.selectedShoppingIds),
            isPublished: true,
          })
        : Promise.resolve([]),
    ]);

    this.assertAllSelectedPointsFound(
      dto.selectedSpotIds,
      spots.map((item) => item.id),
      'spot',
    );
    this.assertAllSelectedPointsFound(
      dto.selectedShoppingIds,
      shopping.map((item) => item.id),
      'shopping',
    );

    for (const spot of spots) {
      this.assertPointWithinCity('spot', spot.id, spot.city, city);
      if (provinceInput) {
        this.assertPointWithinProvince(
          'spot',
          spot.id,
          spot.province,
          provinceInput,
        );
      }
    }
    for (const item of shopping) {
      this.assertPointWithinCity('shopping', item.id, item.city, city);
      if (provinceInput) {
        this.assertPointWithinProvince(
          'shopping',
          item.id,
          item.province,
          provinceInput,
        );
      }
    }

    const selectedPointsByKey = new Map<string, PlannerPointView>();
    const responseLang = this.resolveLang(this.config.tripDefaultLocale);

    for (const spot of spots) {
      const mapped = this.mapSpotToPlannerPoint(spot, responseLang);
      selectedPointsByKey.set(`spot:${spot.id}`, mapped);
    }
    for (const item of shopping) {
      const mapped = this.mapShoppingToPlannerPoint(item, responseLang);
      selectedPointsByKey.set(`shopping:${item.id}`, mapped);
    }

    const selectedPoints: PlannerPointView[] = [
      ...dto.selectedSpotIds.map((id) => selectedPointsByKey.get(`spot:${id}`)),
      ...dto.selectedShoppingIds.map((id) =>
        selectedPointsByKey.get(`shopping:${id}`),
      ),
    ].filter((item): item is PlannerPointView => Boolean(item));

    const inferredProvince = this.inferSingleProvince(
      selectedPoints.map((item) => item.province),
    );
    const province = provinceInput ?? inferredProvince;
    if (!province) {
      throw new BadRequestException({
        code: 'TRIP_PLANNER_PROVINCE_REQUIRED',
        message:
          'Province is required when selected points with the same city span multiple provinces.',
      });
    }

    const hotels = await this.queryHotelsByCity(city, province);
    if (hotels.length === 0) {
      throw new NotFoundException({
        code: 'TRIP_PLANNER_HOTELS_NOT_FOUND',
        message: 'No published hotels found for this city.',
      });
    }

    const hotelCandidates = hotels.map((item) => this.mapHotelCandidate(item));

    const aiInputPoints: PlannerInputPoint[] = selectedPoints.map((item) => ({
      id: item.id,
      pointType: item.pointType,
      name: item.name,
      intro: item.intro,
      suggestedDurationMinutes: item.suggestedDurationMinutes,
      latitude: item.latitude,
      longitude: item.longitude,
    }));

    const aiPlan = await this.aiService.generatePlan({
      city,
      province,
      arrivalDateTime: dto.arrivalDateTime,
      tripDays: dto.tripDays,
      preferredReturnDepartureDateTime: dto.preferredReturnDepartureDateTime,
      regenerateInstruction: dto.regenerateInstruction,
      points: aiInputPoints,
      hotels: hotelCandidates,
    });

    const hotelById = new Map(hotelCandidates.map((item) => [item.id, item]));
    const selectedHotels: PlannerHotelCandidate[] = Array.from(
      new Set(
        aiPlan.days
          .map((item) => item.nightHotelId || item.hotelId)
          .filter(Boolean),
      ),
    )
      .map((hotelId) => hotelById.get(hotelId))
      .filter((item): item is PlannerHotelCandidate => Boolean(item));

    return {
      city,
      province,
      arrivalDateTime: new Date(dto.arrivalDateTime).toISOString(),
      tripDays: dto.tripDays,
      selectedPoints,
      selectedHotels,
      aiPlan,
      links: {
        outboundFlight: this.buildFlightLink({
          direction: 'outbound',
          city,
          province,
          dateTime: dto.arrivalDateTime,
        }),
        hotelBooking: this.buildHotelLink({
          city,
          province,
          checkInDate: aiPlan.checkInDate,
          checkOutDate: aiPlan.checkOutDate,
        }),
        returnFlight: this.buildFlightLink({
          direction: 'return',
          city,
          province,
          dateTime: aiPlan.returnDepartureDateTime,
        }),
      },
    };
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

  private mapSpotToPlannerPoint(
    spot: Spot,
    lang: PlannerLang,
  ): PlannerPointView {
    const nameI18n = this.ensureTextI18n(spot.nameI18n, spot.name);
    const provinceI18n = this.ensureRegionI18n(
      spot.provinceI18n,
      spot.province,
    );
    const cityI18n = this.ensureRegionI18n(spot.cityI18n, spot.city);
    const introI18n = this.ensureIntroI18n(spot.introI18n);

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
        typeof spot.latitude === 'number' && Number.isFinite(spot.latitude)
          ? spot.latitude
          : null,
      longitude:
        typeof spot.longitude === 'number' && Number.isFinite(spot.longitude)
          ? spot.longitude
          : null,
      coverImageUrl: spot.coverImageUrl,
    };
  }

  private mapShoppingToPlannerPoint(
    item: ShoppingPlace,
    lang: PlannerLang,
  ): PlannerPointView {
    const nameI18n = this.ensureTextI18n(item.nameI18n, item.name);
    const provinceI18n = this.ensureRegionI18n(
      item.provinceI18n,
      item.province,
    );
    const cityI18n = this.ensureRegionI18n(item.cityI18n, item.city);
    const introI18n = this.ensureIntroI18n(item.introI18n);

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

  private mapHotelCandidate(hotel: HotelPlace): PlannerHotelCandidate {
    return {
      id: hotel.id,
      name: hotel.name,
      nameI18n: this.ensureTextI18n(hotel.nameI18n, hotel.name),
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
      pricePerNightMinCny: toNullableNumber(hotel.pricePerNightMinCny),
      pricePerNightMaxCny: toNullableNumber(hotel.pricePerNightMaxCny),
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

  private assertAllSelectedPointsFound(
    requestedIds: string[],
    foundIds: string[],
    pointType: 'spot' | 'shopping',
  ): void {
    if (requestedIds.length === foundIds.length) {
      return;
    }
    const foundSet = new Set(foundIds);
    const missingIds = requestedIds.filter((id) => !foundSet.has(id));
    throw new NotFoundException({
      code: 'TRIP_PLANNER_POINTS_NOT_FOUND',
      message: `Some selected ${pointType} points are not found or unpublished.`,
      details: {
        pointType,
        missingIds,
      },
    });
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

  private ensureTextI18n(
    raw: Record<string, string | undefined> | null | undefined,
    fallback: string,
  ): Record<string, string> {
    return {
      'zh-CN': raw?.['zh-CN']?.trim() || fallback,
      'en-US': raw?.['en-US']?.trim() || fallback,
      'mn-MN': raw?.['mn-MN']?.trim() || toCyrillicApprox(fallback),
    };
  }

  private ensureRegionI18n(
    raw: Record<string, string | undefined> | null | undefined,
    fallback: string,
  ): Record<string, string> {
    return {
      'zh-CN': raw?.['zh-CN']?.trim() || fallback,
      'en-US': raw?.['en-US']?.trim() || fallback,
      'mn-MN': raw?.['mn-MN']?.trim() || toCyrillicApprox(fallback),
    };
  }

  private ensureIntroI18n(
    raw: Record<string, string | undefined> | null | undefined,
  ): Record<string, string | undefined> {
    return {
      'zh-CN': raw?.['zh-CN']?.trim() ?? '',
      'en-US': raw?.['en-US']?.trim() ?? '',
      'mn-MN': raw?.['mn-MN']?.trim() ?? '',
    };
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
