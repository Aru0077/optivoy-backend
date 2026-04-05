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
  ensureRegionI18n,
  ensureTextI18n,
  resolveName,
} from '../../common/utils/content-i18n.util';
import {
  BasePlaceService,
  BasePlaceCoreUpdatePayload,
} from '../../common/services/base-place.service';
import { TripPlannerCacheService } from '../trip-planner/trip-planner-cache.service';
import { TransitCacheService } from '../transit-cache/transit-cache.service';

@Injectable()
export class HotelService extends BasePlaceService<HotelPlace> {
  constructor(
    @InjectRepository(HotelPlace)
    private readonly hotelRepository: Repository<HotelPlace>,
    private readonly tripPlannerCacheService: TripPlannerCacheService,
    private readonly transitCacheService: TransitCacheService,
  ) {
    super();
  }

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
    const item = this.hotelRepository.create({
      ...this.buildBaseCoreCreatePayload(dto),
      starLevel: dto.starLevel ?? null,
      checkInTime: dto.checkInTime?.trim() || null,
      checkOutTime: dto.checkOutTime?.trim() || null,
      bookingUrl: dto.bookingUrl?.trim() || null,
      pricePerNightMinCny: dto.pricePerNightMinCny ?? null,
      pricePerNightMaxCny: dto.pricePerNightMaxCny ?? null,
      isPublished: dto.isPublished ?? true,
    });

    const saved = await this.hotelRepository.save(item);
    this.tripPlannerCacheService.invalidateAll();
    await this.transitCacheService.deletePointEdges(saved.id);
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

    this.applyBaseCoreUpdates(item, dto as BasePlaceCoreUpdatePayload);

    if (dto.starLevel !== undefined) {
      item.starLevel = dto.starLevel;
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
          : item.pricePerNightMinCny;
    const nextPricePerNightMaxCny =
      dto.pricePerNightMaxCny !== undefined
        ? dto.pricePerNightMaxCny
        : item.pricePerNightMaxCny === null
          ? null
          : item.pricePerNightMaxCny;

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
      item.pricePerNightMinCny = dto.pricePerNightMinCny;
    }
    if (dto.pricePerNightMaxCny !== undefined) {
      item.pricePerNightMaxCny = dto.pricePerNightMaxCny;
    }

    const saved = await this.hotelRepository.save(item);
    this.tripPlannerCacheService.invalidateAll();
    await this.transitCacheService.deletePointEdges(saved.id);
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
    this.tripPlannerCacheService.invalidateAll();
    await this.transitCacheService.deletePointEdges(itemId);
  }

  async listAdminHotel(
    query: ListAdminHotelQueryDto,
  ): Promise<{ total: number; items: HotelView[] }> {
    const qb = this.hotelRepository
      .createQueryBuilder('hotel')
      .orderBy('hotel."createdAt"', 'DESC');

    if (query.isPublished !== undefined) {
      qb.andWhere('hotel."isPublished" = :isPublished', {
        isPublished: query.isPublished,
      });
    }
    if (query.province) {
      qb.andWhere('hotel.province ILIKE :province', {
        province: `%${query.province}%`,
      });
    }
    if (query.city) {
      qb.andWhere('hotel.city ILIKE :city', {
        city: `%${query.city}%`,
      });
    }

    const total = await qb.getCount();
    const items = await qb.take(query.limit).skip(query.offset).getMany();

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
    const nameI18n = ensureTextI18n(item.nameI18n, item.name);
    const provinceI18n = ensureRegionI18n(item.provinceI18n, item.province);
    const cityI18n = ensureRegionI18n(item.cityI18n, item.city);

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
      starLevel:
        typeof item.starLevel === 'number' && Number.isFinite(item.starLevel)
          ? item.starLevel
          : null,
      checkInTime: item.checkInTime?.trim() || null,
      checkOutTime: item.checkOutTime?.trim() || null,
      bookingUrl: item.bookingUrl?.trim() || null,
      pricePerNightMinCny: item.pricePerNightMinCny,
      pricePerNightMaxCny: item.pricePerNightMaxCny,
      isPublished: item.isPublished,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

}
