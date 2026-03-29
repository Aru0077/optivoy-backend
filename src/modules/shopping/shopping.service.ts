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
  resolveGuide,
  resolveIntro,
  resolveName,
  toCyrillicApprox,
  toNullableNumber,
} from '../../common/utils/content-i18n.util';

@Injectable()
export class ShoppingService {
  constructor(
    @InjectRepository(ShoppingPlace)
    private readonly shoppingRepository: Repository<ShoppingPlace>,
  ) {}

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

    const provinceEn = dto.province.trim();
    const provinceMn = dto.provinceMnMN.trim();
    const provinceZh = dto.provinceZhCN.trim();
    const cityEn = dto.city.trim();
    const cityMn = dto.cityMnMN.trim();
    const cityZh = dto.cityZhCN.trim();

    const nameI18n = {
      'zh-CN': dto.nameZhCN.trim(),
      'mn-MN': dto.nameMnMN.trim(),
      'en-US': dto.nameEn.trim(),
    };
    const provinceI18n = {
      'zh-CN': provinceZh,
      'en-US': provinceEn,
      'mn-MN': provinceMn,
    };
    const cityI18n = {
      'zh-CN': cityZh,
      'en-US': cityEn,
      'mn-MN': cityMn,
    };

    const item = this.shoppingRepository.create({
      name: nameI18n['zh-CN'],
      nameI18n,
      country: 'CN',
      province: provinceEn,
      provinceI18n,
      city: cityEn,
      cityI18n,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      coverImageUrl: dto.coverImageUrl?.trim() || null,
      introI18n: {
        'zh-CN': dto.introZhCN.trim(),
        'mn-MN': dto.introMnMN.trim(),
        'en-US': dto.introEn.trim(),
      },
      guideI18n: {
        'zh-CN': dto.guideZhCN.trim(),
        'mn-MN': dto.guideMnMN.trim(),
        'en-US': dto.guideEn.trim(),
      },
      openingHours: dto.openingHours?.trim() || null,
      suggestedDurationMinutes: dto.suggestedDurationMinutes,
      avgSpendMinCny:
        dto.avgSpendMinCny !== undefined ? dto.avgSpendMinCny.toFixed(2) : null,
      avgSpendMaxCny:
        dto.avgSpendMaxCny !== undefined ? dto.avgSpendMaxCny.toFixed(2) : null,
      isPublished: dto.isPublished ?? true,
    });

    const saved = await this.shoppingRepository.save(item);
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

    if (
      dto.nameZhCN !== undefined ||
      dto.nameMnMN !== undefined ||
      dto.nameEn !== undefined
    ) {
      item.nameI18n = {
        ...((item.nameI18n as Record<string, string>) ?? {}),
        ...(dto.nameZhCN !== undefined ? { 'zh-CN': dto.nameZhCN.trim() } : {}),
        ...(dto.nameMnMN !== undefined ? { 'mn-MN': dto.nameMnMN.trim() } : {}),
        ...(dto.nameEn !== undefined ? { 'en-US': dto.nameEn.trim() } : {}),
      };
      item.name = resolveName(item.nameI18n as Record<string, string>, 'zh-CN');
    }

    if (
      dto.province !== undefined ||
      dto.provinceMnMN !== undefined ||
      dto.provinceZhCN !== undefined
    ) {
      const nextProvinceEn = dto.province?.trim() ?? item.province;
      const provinceI18n = {
        ...((item.provinceI18n as Record<string, string>) ?? {
          'zh-CN': item.province,
          'en-US': item.province,
          'mn-MN': toCyrillicApprox(item.province),
        }),
        ...(dto.province !== undefined ? { 'en-US': nextProvinceEn } : {}),
        ...(dto.provinceZhCN !== undefined
          ? { 'zh-CN': dto.provinceZhCN.trim() }
          : {}),
        ...(dto.provinceMnMN !== undefined
          ? { 'mn-MN': dto.provinceMnMN.trim() }
          : {}),
      };
      if (dto.province !== undefined && dto.provinceMnMN === undefined) {
        provinceI18n['mn-MN'] = toCyrillicApprox(nextProvinceEn);
      }
      item.province = nextProvinceEn;
      item.provinceI18n = provinceI18n;
    }

    if (
      dto.city !== undefined ||
      dto.cityMnMN !== undefined ||
      dto.cityZhCN !== undefined
    ) {
      const nextCityEn = dto.city?.trim() ?? item.city;
      const cityI18n = {
        ...((item.cityI18n as Record<string, string>) ?? {
          'zh-CN': item.city,
          'en-US': item.city,
          'mn-MN': toCyrillicApprox(item.city),
        }),
        ...(dto.city !== undefined ? { 'en-US': nextCityEn } : {}),
        ...(dto.cityZhCN !== undefined ? { 'zh-CN': dto.cityZhCN.trim() } : {}),
        ...(dto.cityMnMN !== undefined ? { 'mn-MN': dto.cityMnMN.trim() } : {}),
      };
      if (dto.city !== undefined && dto.cityMnMN === undefined) {
        cityI18n['mn-MN'] = toCyrillicApprox(nextCityEn);
      }
      item.city = nextCityEn;
      item.cityI18n = cityI18n;
    }

    if (dto.latitude !== undefined) item.latitude = dto.latitude;
    if (dto.longitude !== undefined) item.longitude = dto.longitude;
    if (dto.coverImageUrl !== undefined)
      item.coverImageUrl = dto.coverImageUrl?.trim() || null;

    if (
      dto.introZhCN !== undefined ||
      dto.introMnMN !== undefined ||
      dto.introEn !== undefined
    ) {
      item.introI18n = {
        ...item.introI18n,
        ...(dto.introZhCN !== undefined
          ? { 'zh-CN': dto.introZhCN.trim() }
          : {}),
        ...(dto.introMnMN !== undefined
          ? { 'mn-MN': dto.introMnMN.trim() }
          : {}),
        ...(dto.introEn !== undefined ? { 'en-US': dto.introEn.trim() } : {}),
      };
    }

    if (
      dto.guideZhCN !== undefined ||
      dto.guideMnMN !== undefined ||
      dto.guideEn !== undefined
    ) {
      item.guideI18n = {
        ...(item.guideI18n ?? {}),
        ...(dto.guideZhCN !== undefined
          ? { 'zh-CN': dto.guideZhCN.trim() }
          : {}),
        ...(dto.guideMnMN !== undefined
          ? { 'mn-MN': dto.guideMnMN.trim() }
          : {}),
        ...(dto.guideEn !== undefined ? { 'en-US': dto.guideEn.trim() } : {}),
      };
    }

    if (dto.openingHours !== undefined) {
      item.openingHours = dto.openingHours?.trim() || null;
    }
    if (dto.suggestedDurationMinutes !== undefined) {
      item.suggestedDurationMinutes = dto.suggestedDurationMinutes;
    }

    const nextAvgSpendMinCny =
      dto.avgSpendMinCny !== undefined
        ? dto.avgSpendMinCny
        : item.avgSpendMinCny === null
          ? null
          : Number(item.avgSpendMinCny);
    const nextAvgSpendMaxCny =
      dto.avgSpendMaxCny !== undefined
        ? dto.avgSpendMaxCny
        : item.avgSpendMaxCny === null
          ? null
          : Number(item.avgSpendMaxCny);

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
      item.avgSpendMinCny = dto.avgSpendMinCny.toFixed(2);
    }
    if (dto.avgSpendMaxCny !== undefined) {
      item.avgSpendMaxCny = dto.avgSpendMaxCny.toFixed(2);
    }

    if (dto.isPublished !== undefined) {
      item.isPublished = dto.isPublished;
    }

    const saved = await this.shoppingRepository.save(item);
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
  }

  async listAdminShopping(
    query: ListAdminShoppingQueryDto,
  ): Promise<{ total: number; items: ShoppingView[] }> {
    const where: { isPublished?: boolean } = {};
    if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }
    const [items, total] = await this.shoppingRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit,
      skip: query.offset,
    });
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
    const nameI18n = (item.nameI18n ?? {
      'mn-MN': item.name,
      'en-US': item.name,
      'zh-CN': item.name,
    }) as Record<string, string>;
    const provinceI18n = (item.provinceI18n ?? {
      'en-US': item.province,
      'mn-MN': toCyrillicApprox(item.province),
      'zh-CN': item.province,
    }) as Record<string, string>;
    const cityI18n = (item.cityI18n ?? {
      'en-US': item.city,
      'mn-MN': toCyrillicApprox(item.city),
      'zh-CN': item.city,
    }) as Record<string, string>;
    const introI18n = item.introI18n ?? {};
    const guideI18n = item.guideI18n ?? {};

    return {
      id: item.id,
      name: resolveName(nameI18n, lang),
      nameI18n,
      country: item.country,
      province: item.province,
      provinceI18n,
      city: item.city,
      cityI18n,
      latitude: toNullableNumber(item.latitude),
      longitude: toNullableNumber(item.longitude),
      coverImageUrl: item.coverImageUrl,
      intro: resolveIntro(introI18n, lang),
      introI18n,
      guide: resolveGuide(guideI18n, lang),
      guideI18n,
      openingHours: item.openingHours?.trim() || null,
      suggestedDurationMinutes: item.suggestedDurationMinutes ?? 240,
      avgSpendMinCny: toNullableNumber(item.avgSpendMinCny),
      avgSpendMaxCny: toNullableNumber(item.avgSpendMaxCny),
      isPublished: item.isPublished,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
