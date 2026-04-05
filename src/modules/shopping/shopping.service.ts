import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListAdminShoppingQueryDto } from './dto/list-admin-shopping-query.dto';
import {
  ListShoppingQueryDto,
  ShoppingLang,
} from './dto/list-shopping-query.dto';
import { CreateShoppingDto } from './dto/create-shopping.dto';
import { UpdateShoppingDto } from './dto/update-shopping.dto';
import { ShoppingPlace } from './entities/shopping.entity';
import { ShoppingView } from './shopping.types';
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
import {
  BasePlaceService,
  BasePlaceUpdatePayload,
} from '../../common/services/base-place.service';
import {
  normalizeOpeningHours,
  normalizeSpecialDates,
} from '../../common/utils/planning-metadata.util';
import { TripPlannerCacheService } from '../trip-planner/trip-planner-cache.service';
import { TransitCacheService } from '../transit-cache/transit-cache.service';

@Injectable()
export class ShoppingService extends BasePlaceService<ShoppingPlace> {
  constructor(
    @InjectRepository(ShoppingPlace)
    private readonly shoppingRepository: Repository<ShoppingPlace>,
    private readonly tripPlannerCacheService: TripPlannerCacheService,
    private readonly transitCacheService: TransitCacheService,
  ) {
    super();
  }

  async createShopping(dto: CreateShoppingDto): Promise<ShoppingView> {
    if (
      dto.avgSpendMinCny !== undefined &&
      dto.avgSpendMaxCny !== undefined &&
      dto.avgSpendMaxCny < dto.avgSpendMinCny
    ) {
      throw new BadRequestException({
        code: 'SHOPPING_AVG_SPEND_RANGE_INVALID',
        message:
          'avgSpendMaxCny must be greater than or equal to avgSpendMinCny.',
      });
    }
    const planningMetadata = this.normalizePlanningMetadata(dto);

    const item = this.shoppingRepository.create({
      ...this.buildBaseCreatePayload(dto),
      openingHoursJson: planningMetadata.openingHoursJson,
      specialClosureDates: planningMetadata.specialClosureDates,
      suggestedDurationMinutes: dto.suggestedDurationMinutes,
      hasFoodCourt: dto.hasFoodCourt ?? false,
      avgSpendMinCny: dto.avgSpendMinCny ?? null,
      avgSpendMaxCny: dto.avgSpendMaxCny ?? null,
      isPublished: dto.isPublished ?? true,
    });

    const saved = await this.shoppingRepository.save(item);
    this.tripPlannerCacheService.invalidateAll();
    await this.transitCacheService.deletePointEdges(saved.id);
    return this.mapShopping(saved, 'zh-CN');
  }

  async updateShopping(
    itemId: string,
    dto: UpdateShoppingDto,
  ): Promise<ShoppingView> {
    const item = await this.shoppingRepository.findOneBy({ id: itemId });
    if (!item) {
      throw new NotFoundException({
        code: 'SHOPPING_NOT_FOUND',
        message: 'Shopping place not found.',
      });
    }

    this.applyBaseUpdates(item, dto as BasePlaceUpdatePayload);
    const planningMetadata = this.normalizePlanningMetadata(dto, item);

    if (dto.openingHoursJson !== undefined) {
      item.openingHoursJson = planningMetadata.openingHoursJson;
    }
    if (dto.specialClosureDates !== undefined) {
      item.specialClosureDates = planningMetadata.specialClosureDates;
    }
    if (dto.suggestedDurationMinutes !== undefined) {
      item.suggestedDurationMinutes = dto.suggestedDurationMinutes;
    }
    if (dto.hasFoodCourt !== undefined) {
      item.hasFoodCourt = dto.hasFoodCourt;
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
        code: 'SHOPPING_AVG_SPEND_RANGE_INVALID',
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

    const saved = await this.shoppingRepository.save(item);
    this.tripPlannerCacheService.invalidateAll();
    await this.transitCacheService.deletePointEdges(saved.id);
    return this.mapShopping(saved, 'zh-CN');
  }

  async deleteShopping(itemId: string): Promise<void> {
    const result = await this.shoppingRepository.delete({ id: itemId });
    if ((result.affected ?? 0) === 0) {
      throw new NotFoundException({
        code: 'SHOPPING_NOT_FOUND',
        message: 'Shopping place not found.',
      });
    }
    this.tripPlannerCacheService.invalidateAll();
    await this.transitCacheService.deletePointEdges(itemId);
  }

  async listAdminShopping(
    query: ListAdminShoppingQueryDto,
  ): Promise<{ total: number; items: ShoppingView[] }> {
    const qb = this.shoppingRepository
      .createQueryBuilder('shopping')
      .orderBy('shopping."createdAt"', 'DESC');

    if (query.isPublished !== undefined) {
      qb.andWhere('shopping."isPublished" = :isPublished', {
        isPublished: query.isPublished,
      });
    }
    if (query.province) {
      qb.andWhere('shopping.province ILIKE :province', {
        province: `%${query.province}%`,
      });
    }
    if (query.city) {
      qb.andWhere('shopping.city ILIKE :city', {
        city: `%${query.city}%`,
      });
    }

    const total = await qb.getCount();
    const items = await qb.take(query.limit).skip(query.offset).getMany();

    return {
      total,
      items: items.map((item) => this.mapShopping(item, 'zh-CN')),
    };
  }

  async getAdminShoppingById(itemId: string): Promise<ShoppingView> {
    const item = await this.shoppingRepository.findOneBy({ id: itemId });
    if (!item) {
      throw new NotFoundException({
        code: 'SHOPPING_NOT_FOUND',
        message: 'Shopping place not found.',
      });
    }
    return this.mapShopping(item, 'zh-CN');
  }

  async listShopping(
    query: ListShoppingQueryDto,
  ): Promise<{ total: number; items: ShoppingView[] }> {
    const qb = this.shoppingRepository
      .createQueryBuilder('shopping')
      .where('shopping."isPublished" = true');

    if (query.province) {
      qb.andWhere('shopping.province ILIKE :province', {
        province: `%${query.province.trim()}%`,
      });
    }
    if (query.city) {
      qb.andWhere('shopping.city ILIKE :city', {
        city: `%${query.city.trim()}%`,
      });
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('shopping."createdAt"', 'DESC')
      .take(query.limit)
      .skip(query.offset)
      .getMany();

    return {
      total,
      items: rows.map((item) => this.mapShopping(item, query.lang)),
    };
  }

  async getShoppingById(
    itemId: string,
    lang: ShoppingLang,
  ): Promise<ShoppingView> {
    const item = await this.shoppingRepository.findOneBy({
      id: itemId,
      isPublished: true,
    });
    if (!item) {
      throw new NotFoundException({
        code: 'SHOPPING_NOT_FOUND',
        message: 'Shopping place not found.',
      });
    }
    return this.mapShopping(item, lang);
  }

  private mapShopping(item: ShoppingPlace, lang: ShoppingLang): ShoppingView {
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
      openingHoursJson: normalizeOpeningHours(item.openingHoursJson),
      specialClosureDates: normalizeSpecialDates(item.specialClosureDates),
      suggestedDurationMinutes: item.suggestedDurationMinutes ?? 240,
      hasFoodCourt: item.hasFoodCourt === true,
      avgSpendMinCny: item.avgSpendMinCny,
      avgSpendMaxCny: item.avgSpendMaxCny,
      isPublished: item.isPublished,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private normalizePlanningMetadata(
    dto: Pick<
      CreateShoppingDto | UpdateShoppingDto,
      | 'openingHoursJson'
      | 'specialClosureDates'
    >,
    current?: ShoppingPlace,
  ) {
    try {
      return {
        openingHoursJson:
          dto.openingHoursJson !== undefined
            ? normalizeOpeningHours(dto.openingHoursJson)
            : (current?.openingHoursJson ?? null),
        specialClosureDates:
          dto.specialClosureDates !== undefined
            ? normalizeSpecialDates(dto.specialClosureDates)
            : (current?.specialClosureDates ?? null),
      };
    } catch (error) {
      throw new BadRequestException({
        code: 'SHOPPING_PLANNING_METADATA_INVALID',
        message:
          error instanceof Error
            ? error.message
            : 'Shopping planning metadata is invalid.',
      });
    }
  }
}
