import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListAdminHotelQueryDto } from './dto/list-admin-hotel-query.dto';
import { ListHotelQueryDto, HotelLang } from './dto/list-hotel-query.dto';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { HotelPlace } from './entities/hotel.entity';
import { HotelView } from './hotel.types';
import {
  resolveGuide,
  resolveIntro,
  resolveName,
  toCyrillicApprox,
  toNullableNumber,
} from '../../common/utils/content-i18n.util';

@Injectable()
export class HotelService {
  constructor(
    @InjectRepository(HotelPlace)
    private readonly hotelRepository: Repository<HotelPlace>,
  ) {}

  async createHotel(dto: CreateHotelDto): Promise<HotelView> {
    if (
      dto.pricePerNightMinCny !== undefined &&
      dto.pricePerNightMaxCny !== undefined &&
      dto.pricePerNightMaxCny < dto.pricePerNightMinCny
    ) {
      throw new BadRequestException({
        code: 'HOTEL_PRICE_PER_NIGHT_RANGE_INVALID',
        message:
          'pricePerNightMaxCny must be greater than or equal to pricePerNightMinCny.',
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

    const item = this.hotelRepository.create({
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
      starLevel: dto.starLevel ?? null,
      foreignerFriendly: dto.foreignerFriendly ?? true,
      checkInTime: dto.checkInTime?.trim() || null,
      checkOutTime: dto.checkOutTime?.trim() || null,
      bookingUrl: dto.bookingUrl?.trim() || null,
      pricePerNightMinCny:
        dto.pricePerNightMinCny !== undefined
          ? dto.pricePerNightMinCny.toFixed(2)
          : null,
      pricePerNightMaxCny:
        dto.pricePerNightMaxCny !== undefined
          ? dto.pricePerNightMaxCny.toFixed(2)
          : null,
      isPublished: dto.isPublished ?? true,
    });

    const saved = await this.hotelRepository.save(item);
    return this.mapHotel(saved, 'zh-CN');
  }

  async updateHotel(itemId: string, dto: UpdateHotelDto): Promise<HotelView> {
    const item = await this.hotelRepository.findOneBy({ id: itemId });
    if (!item) {
      throw new NotFoundException({
        code: 'HOTEL_NOT_FOUND',
        message: 'Hotel not found.',
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

    if (dto.starLevel !== undefined) {
      item.starLevel = dto.starLevel;
    }
    if (dto.foreignerFriendly !== undefined) {
      item.foreignerFriendly = dto.foreignerFriendly;
    }
    if (dto.checkInTime !== undefined) {
      item.checkInTime = dto.checkInTime?.trim() || null;
    }
    if (dto.checkOutTime !== undefined) {
      item.checkOutTime = dto.checkOutTime?.trim() || null;
    }
    if (dto.bookingUrl !== undefined) {
      item.bookingUrl = dto.bookingUrl?.trim() || null;
    }

    const nextPricePerNightMinCny =
      dto.pricePerNightMinCny !== undefined
        ? dto.pricePerNightMinCny
        : item.pricePerNightMinCny === null
          ? null
          : Number(item.pricePerNightMinCny);
    const nextPricePerNightMaxCny =
      dto.pricePerNightMaxCny !== undefined
        ? dto.pricePerNightMaxCny
        : item.pricePerNightMaxCny === null
          ? null
          : Number(item.pricePerNightMaxCny);

    if (
      nextPricePerNightMinCny !== null &&
      nextPricePerNightMaxCny !== null &&
      nextPricePerNightMaxCny < nextPricePerNightMinCny
    ) {
      throw new BadRequestException({
        code: 'HOTEL_PRICE_PER_NIGHT_RANGE_INVALID',
        message:
          'pricePerNightMaxCny must be greater than or equal to pricePerNightMinCny.',
      });
    }

    if (dto.pricePerNightMinCny !== undefined) {
      item.pricePerNightMinCny = dto.pricePerNightMinCny.toFixed(2);
    }
    if (dto.pricePerNightMaxCny !== undefined) {
      item.pricePerNightMaxCny = dto.pricePerNightMaxCny.toFixed(2);
    }

    if (dto.isPublished !== undefined) {
      item.isPublished = dto.isPublished;
    }

    const saved = await this.hotelRepository.save(item);
    return this.mapHotel(saved, 'zh-CN');
  }

  async deleteHotel(itemId: string): Promise<void> {
    const result = await this.hotelRepository.delete({ id: itemId });
    if ((result.affected ?? 0) === 0) {
      throw new NotFoundException({
        code: 'HOTEL_NOT_FOUND',
        message: 'Hotel not found.',
      });
    }
  }

  async listAdminHotel(
    query: ListAdminHotelQueryDto,
  ): Promise<{ total: number; items: HotelView[] }> {
    const where: { isPublished?: boolean } = {};
    if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }
    const [items, total] = await this.hotelRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit,
      skip: query.offset,
    });
    return {
      total,
      items: items.map((item) => this.mapHotel(item, 'zh-CN')),
    };
  }

  async getAdminHotelById(itemId: string): Promise<HotelView> {
    const item = await this.hotelRepository.findOneBy({ id: itemId });
    if (!item) {
      throw new NotFoundException({
        code: 'HOTEL_NOT_FOUND',
        message: 'Hotel not found.',
      });
    }
    return this.mapHotel(item, 'zh-CN');
  }

  async listHotel(
    query: ListHotelQueryDto,
  ): Promise<{ total: number; items: HotelView[] }> {
    const qb = this.hotelRepository
      .createQueryBuilder('hotel')
      .where('hotel."isPublished" = true');

    if (query.province) {
      qb.andWhere('hotel.province ILIKE :province', {
        province: `%${query.province.trim()}%`,
      });
    }
    if (query.city) {
      qb.andWhere('hotel.city ILIKE :city', { city: `%${query.city.trim()}%` });
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('hotel."createdAt"', 'DESC')
      .take(query.limit)
      .skip(query.offset)
      .getMany();

    return {
      total,
      items: rows.map((item) => this.mapHotel(item, query.lang)),
    };
  }

  async getHotelById(itemId: string, lang: HotelLang): Promise<HotelView> {
    const item = await this.hotelRepository.findOneBy({
      id: itemId,
      isPublished: true,
    });
    if (!item) {
      throw new NotFoundException({
        code: 'HOTEL_NOT_FOUND',
        message: 'Hotel not found.',
      });
    }
    return this.mapHotel(item, lang);
  }

  private mapHotel(item: HotelPlace, lang: HotelLang): HotelView {
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
      starLevel:
        typeof item.starLevel === 'number' && Number.isFinite(item.starLevel)
          ? item.starLevel
          : null,
      foreignerFriendly: item.foreignerFriendly !== false,
      checkInTime: item.checkInTime?.trim() || null,
      checkOutTime: item.checkOutTime?.trim() || null,
      bookingUrl: item.bookingUrl?.trim() || null,
      pricePerNightMinCny: toNullableNumber(item.pricePerNightMinCny),
      pricePerNightMaxCny: toNullableNumber(item.pricePerNightMaxCny),
      isPublished: item.isPublished,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
