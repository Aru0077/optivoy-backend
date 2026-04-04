import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BasePlaceService,
  BasePlaceUpdatePayload,
} from '../../common/services/base-place.service';
import {
  ensureCoordinatePair,
  normalizeMealTimeWindows,
  normalizeQueueProfile,
} from '../../common/utils/planning-metadata.util';
import {
  ensureGuideI18n,
  ensureIntroI18n,
  ensureNoticeI18n,
  ensureRegionI18n,
  ensureTextI18n,
  resolveGuide,
  resolveIntro,
  resolveName,
  resolveNotice,
} from '../../common/utils/content-i18n.util';
import { TripPlannerCacheService } from '../trip-planner/trip-planner-cache.service';
import { TransitCacheService } from '../transit-cache/transit-cache.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { ListAdminRestaurantQueryDto } from './dto/list-admin-restaurant-query.dto';
import {
  ListRestaurantQueryDto,
  RestaurantLang,
} from './dto/list-restaurant-query.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import {
  RestaurantMealSlot,
  RestaurantPlace,
} from './entities/restaurant.entity';
import { RestaurantView } from './restaurant.types';

const RESTAURANT_MEAL_SLOTS: RestaurantMealSlot[] = [
  'breakfast',
  'lunch',
  'dinner',
  'night_snack',
];

@Injectable()
export class RestaurantService extends BasePlaceService<RestaurantPlace> {
  constructor(
    @InjectRepository(RestaurantPlace)
    private readonly restaurantRepository: Repository<RestaurantPlace>,
    private readonly tripPlannerCacheService: TripPlannerCacheService,
    private readonly transitCacheService: TransitCacheService,
  ) {
    super();
  }

  async createRestaurant(dto: CreateRestaurantDto): Promise<RestaurantView> {
    if (
      dto.avgSpendMinCny !== undefined &&
      dto.avgSpendMaxCny !== undefined &&
      dto.avgSpendMaxCny < dto.avgSpendMinCny
    ) {
      throw new BadRequestException({
        code: 'RESTAURANT_AVG_SPEND_RANGE_INVALID',
        message:
          'avgSpendMaxCny must be greater than or equal to avgSpendMinCny.',
      });
    }

    if (dto.reservationRequired && !dto.reservationUrl?.trim()) {
      throw new BadRequestException({
        code: 'RESTAURANT_RESERVATION_URL_REQUIRED',
        message: 'reservationUrl is required when reservationRequired is true.',
      });
    }

    const mealSlots = normalizeMealSlots(dto.mealSlots);
    if (mealSlots.length === 0) {
      throw new BadRequestException({
        code: 'RESTAURANT_MEAL_SLOTS_REQUIRED',
        message: 'mealSlots must contain at least one value.',
      });
    }
    const planningMetadata = this.normalizePlanningMetadata(dto, mealSlots);

    const item = this.restaurantRepository.create({
      ...this.buildBaseCreatePayload(dto),
      arrivalAnchorLatitude: planningMetadata.arrivalAnchorLatitude,
      arrivalAnchorLongitude: planningMetadata.arrivalAnchorLongitude,
      departureAnchorLatitude: planningMetadata.departureAnchorLatitude,
      departureAnchorLongitude: planningMetadata.departureAnchorLongitude,
      suggestedDurationMinutes: dto.suggestedDurationMinutes,
      mealSlots,
      mealTimeWindowsJson: planningMetadata.mealTimeWindowsJson,
      cuisineTags: normalizeStringArray(dto.cuisineTags),
      reservationRequired: dto.reservationRequired ?? false,
      reservationUrl: dto.reservationUrl?.trim() || null,
      queueProfileJson: planningMetadata.queueProfileJson,
      avgSpendMinCny: dto.avgSpendMinCny ?? null,
      avgSpendMaxCny: dto.avgSpendMaxCny ?? null,
      isPublished: dto.isPublished ?? true,
    });

    const saved = await this.restaurantRepository.save(item);
    this.tripPlannerCacheService.invalidateAll();
    await this.transitCacheService.deletePointEdges(saved.id);
    return this.mapRestaurant(saved, 'zh-CN');
  }

  async updateRestaurant(
    itemId: string,
    dto: UpdateRestaurantDto,
  ): Promise<RestaurantView> {
    const item = await this.restaurantRepository.findOneBy({ id: itemId });
    if (!item) {
      throw new NotFoundException({
        code: 'RESTAURANT_NOT_FOUND',
        message: 'Restaurant not found.',
      });
    }

    this.applyBaseUpdates(item, dto as BasePlaceUpdatePayload);

    const nextReservationRequired =
      dto.reservationRequired ?? item.reservationRequired ?? false;
    const nextReservationUrl =
      dto.reservationUrl !== undefined
        ? dto.reservationUrl?.trim() || null
        : item.reservationUrl?.trim() || null;

    if (nextReservationRequired && !nextReservationUrl) {
      throw new BadRequestException({
        code: 'RESTAURANT_RESERVATION_URL_REQUIRED',
        message: 'reservationUrl is required when reservationRequired is true.',
      });
    }
    const nextMealSlots =
      dto.mealSlots !== undefined
        ? normalizeMealSlots(dto.mealSlots)
        : normalizeMealSlots(item.mealSlots);
    const planningMetadata = this.normalizePlanningMetadata(
      dto,
      nextMealSlots,
      item,
    );

    if (dto.suggestedDurationMinutes !== undefined) {
      item.suggestedDurationMinutes = dto.suggestedDurationMinutes;
    }
    if (dto.mealSlots !== undefined) {
      if (nextMealSlots.length === 0) {
        throw new BadRequestException({
          code: 'RESTAURANT_MEAL_SLOTS_REQUIRED',
          message: 'mealSlots must contain at least one value.',
        });
      }
      item.mealSlots = nextMealSlots;
    }
    if (dto.arrivalAnchorLatitude !== undefined) {
      item.arrivalAnchorLatitude = planningMetadata.arrivalAnchorLatitude;
    }
    if (dto.arrivalAnchorLongitude !== undefined) {
      item.arrivalAnchorLongitude = planningMetadata.arrivalAnchorLongitude;
    }
    if (dto.departureAnchorLatitude !== undefined) {
      item.departureAnchorLatitude = planningMetadata.departureAnchorLatitude;
    }
    if (dto.departureAnchorLongitude !== undefined) {
      item.departureAnchorLongitude = planningMetadata.departureAnchorLongitude;
    }
    if (dto.mealTimeWindowsJson !== undefined) {
      item.mealTimeWindowsJson = planningMetadata.mealTimeWindowsJson;
    }
    if (dto.cuisineTags !== undefined) {
      item.cuisineTags = normalizeStringArray(dto.cuisineTags);
    }
    if (dto.reservationRequired !== undefined) {
      item.reservationRequired = dto.reservationRequired;
    }
    if (dto.reservationUrl !== undefined) {
      item.reservationUrl = dto.reservationUrl?.trim() || null;
    }
    if (dto.queueProfileJson !== undefined) {
      item.queueProfileJson = planningMetadata.queueProfileJson;
    }

    const nextAvgSpendMinCny =
      dto.avgSpendMinCny !== undefined
        ? dto.avgSpendMinCny
        : item.avgSpendMinCny === null
          ? null
          : item.avgSpendMinCny;

    const nextAvgSpendMaxCny =
      dto.avgSpendMaxCny !== undefined
        ? dto.avgSpendMaxCny
        : item.avgSpendMaxCny === null
          ? null
          : item.avgSpendMaxCny;

    if (
      nextAvgSpendMinCny !== null &&
      nextAvgSpendMaxCny !== null &&
      nextAvgSpendMaxCny < nextAvgSpendMinCny
    ) {
      throw new BadRequestException({
        code: 'RESTAURANT_AVG_SPEND_RANGE_INVALID',
        message:
          'avgSpendMaxCny must be greater than or equal to avgSpendMinCny.',
      });
    }

    if (dto.avgSpendMinCny !== undefined) {
      item.avgSpendMinCny = dto.avgSpendMinCny;
    }
    if (dto.avgSpendMaxCny !== undefined) {
      item.avgSpendMaxCny = dto.avgSpendMaxCny;
    }

    const saved = await this.restaurantRepository.save(item);
    this.tripPlannerCacheService.invalidateAll();
    await this.transitCacheService.deletePointEdges(saved.id);
    return this.mapRestaurant(saved, 'zh-CN');
  }

  async deleteRestaurant(itemId: string): Promise<void> {
    const result = await this.restaurantRepository.delete({ id: itemId });
    if ((result.affected ?? 0) === 0) {
      throw new NotFoundException({
        code: 'RESTAURANT_NOT_FOUND',
        message: 'Restaurant not found.',
      });
    }
    this.tripPlannerCacheService.invalidateAll();
    await this.transitCacheService.deletePointEdges(itemId);
  }

  async listAdminRestaurant(
    query: ListAdminRestaurantQueryDto,
  ): Promise<{ total: number; items: RestaurantView[] }> {
    const qb = this.restaurantRepository
      .createQueryBuilder('restaurant')
      .orderBy('restaurant."createdAt"', 'DESC');

    if (query.isPublished !== undefined) {
      qb.andWhere('restaurant."isPublished" = :isPublished', {
        isPublished: query.isPublished,
      });
    }
    if (query.province) {
      qb.andWhere('restaurant.province ILIKE :province', {
        province: `%${query.province}%`,
      });
    }
    if (query.city) {
      qb.andWhere('restaurant.city ILIKE :city', {
        city: `%${query.city}%`,
      });
    }

    const total = await qb.getCount();
    const items = await qb
      .take(query.limit)
      .skip(query.offset)
      .getMany();

    return {
      total,
      items: items.map((item) => this.mapRestaurant(item, 'zh-CN')),
    };
  }

  async getAdminRestaurantById(itemId: string): Promise<RestaurantView> {
    const item = await this.restaurantRepository.findOneBy({ id: itemId });
    if (!item) {
      throw new NotFoundException({
        code: 'RESTAURANT_NOT_FOUND',
        message: 'Restaurant not found.',
      });
    }
    return this.mapRestaurant(item, 'zh-CN');
  }

  async listRestaurant(
    query: ListRestaurantQueryDto,
  ): Promise<{ total: number; items: RestaurantView[] }> {
    const qb = this.restaurantRepository
      .createQueryBuilder('restaurant')
      .where('restaurant."isPublished" = true');

    if (query.province) {
      qb.andWhere('restaurant.province ILIKE :province', {
        province: `%${query.province.trim()}%`,
      });
    }

    if (query.city) {
      qb.andWhere('restaurant.city ILIKE :city', {
        city: `%${query.city.trim()}%`,
      });
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('restaurant."createdAt"', 'DESC')
      .take(query.limit)
      .skip(query.offset)
      .getMany();

    return {
      total,
      items: rows.map((item) => this.mapRestaurant(item, query.lang)),
    };
  }

  async getRestaurantById(
    itemId: string,
    lang: RestaurantLang,
  ): Promise<RestaurantView> {
    const item = await this.restaurantRepository.findOneBy({
      id: itemId,
      isPublished: true,
    });
    if (!item) {
      throw new NotFoundException({
        code: 'RESTAURANT_NOT_FOUND',
        message: 'Restaurant not found.',
      });
    }
    return this.mapRestaurant(item, lang);
  }

  private mapRestaurant(
    item: RestaurantPlace,
    lang: RestaurantLang,
  ): RestaurantView {
    const nameI18n = ensureTextI18n(item.nameI18n, item.name);
    const provinceI18n = ensureRegionI18n(item.provinceI18n, item.province);
    const cityI18n = ensureRegionI18n(item.cityI18n, item.city);
    const introI18n = ensureIntroI18n(item.introI18n);
    const guideI18n = ensureGuideI18n(item.guideI18n);
    const noticeI18n = ensureNoticeI18n(item.noticeI18n);

    return {
      id: item.id,
      name: resolveName(nameI18n, lang),
      nameI18n,
      country: item.country,
      province: item.province,
      provinceI18n,
      city: item.city,
      cityI18n,
      latitude: item.latitude,
      longitude: item.longitude,
      coverImageUrl: item.coverImageUrl,
      intro: resolveIntro(introI18n, lang),
      introI18n,
      guide: resolveGuide(guideI18n, lang),
      guideI18n,
      notice: resolveNotice(noticeI18n, lang),
      noticeI18n,
      arrivalAnchorLatitude: item.arrivalAnchorLatitude,
      arrivalAnchorLongitude: item.arrivalAnchorLongitude,
      departureAnchorLatitude: item.departureAnchorLatitude,
      departureAnchorLongitude: item.departureAnchorLongitude,
      suggestedDurationMinutes: item.suggestedDurationMinutes ?? 90,
      mealSlots: normalizeMealSlots(item.mealSlots),
      mealTimeWindowsJson: normalizeMealTimeWindows(item.mealTimeWindowsJson),
      cuisineTags: normalizeStringArray(item.cuisineTags),
      reservationRequired: item.reservationRequired === true,
      reservationUrl: item.reservationUrl?.trim() || null,
      queueProfileJson: normalizeQueueProfile(item.queueProfileJson),
      avgSpendMinCny: item.avgSpendMinCny,
      avgSpendMaxCny: item.avgSpendMaxCny,
      isPublished: item.isPublished,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private normalizePlanningMetadata(
    dto: Pick<
      CreateRestaurantDto | UpdateRestaurantDto,
      | 'arrivalAnchorLatitude'
      | 'arrivalAnchorLongitude'
      | 'departureAnchorLatitude'
      | 'departureAnchorLongitude'
      | 'mealTimeWindowsJson'
      | 'queueProfileJson'
    >,
    mealSlots: RestaurantMealSlot[],
    current?: RestaurantPlace,
  ) {
    try {
      const arrivalAnchorLatitude =
        dto.arrivalAnchorLatitude !== undefined
          ? dto.arrivalAnchorLatitude ?? null
          : current?.arrivalAnchorLatitude ?? null;
      const arrivalAnchorLongitude =
        dto.arrivalAnchorLongitude !== undefined
          ? dto.arrivalAnchorLongitude ?? null
          : current?.arrivalAnchorLongitude ?? null;
      const departureAnchorLatitude =
        dto.departureAnchorLatitude !== undefined
          ? dto.departureAnchorLatitude ?? null
          : current?.departureAnchorLatitude ?? null;
      const departureAnchorLongitude =
        dto.departureAnchorLongitude !== undefined
          ? dto.departureAnchorLongitude ?? null
          : current?.departureAnchorLongitude ?? null;

      ensureCoordinatePair(
        arrivalAnchorLatitude,
        arrivalAnchorLongitude,
        'arrivalAnchor',
      );
      ensureCoordinatePair(
        departureAnchorLatitude,
        departureAnchorLongitude,
        'departureAnchor',
      );

      const mealTimeWindowsJson =
        dto.mealTimeWindowsJson !== undefined
          ? normalizeMealTimeWindows(dto.mealTimeWindowsJson)
          : current?.mealTimeWindowsJson ?? null;

      if (mealTimeWindowsJson?.length) {
        for (const window of mealTimeWindowsJson) {
          if (!mealSlots.includes(window.mealSlot)) {
            throw new Error(
              `mealTimeWindowsJson contains mealSlot ${window.mealSlot} which is not present in mealSlots.`,
            );
          }
        }
      }

      return {
        arrivalAnchorLatitude,
        arrivalAnchorLongitude,
        departureAnchorLatitude,
        departureAnchorLongitude,
        mealTimeWindowsJson,
        queueProfileJson:
          dto.queueProfileJson !== undefined
            ? normalizeQueueProfile(dto.queueProfileJson)
            : current?.queueProfileJson ?? null,
      };
    } catch (error) {
      throw new BadRequestException({
        code: 'RESTAURANT_PLANNING_METADATA_INVALID',
        message:
          error instanceof Error
            ? error.message
            : 'Restaurant planning metadata is invalid.',
      });
    }
  }
}

function normalizeStringArray(values?: string[] | null): string[] {
  if (!values?.length) {
    return [];
  }
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
}

function normalizeMealSlots(values?: RestaurantMealSlot[] | null): RestaurantMealSlot[] {
  if (!values?.length) {
    return [];
  }
  const normalized = values.filter((value) =>
    RESTAURANT_MEAL_SLOTS.includes(value),
  );
  return Array.from(new Set(normalized));
}
