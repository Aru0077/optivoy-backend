import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateSpotDto } from './dto/create-spot.dto';
import { ListAdminSpotsQueryDto } from './dto/list-admin-spots-query.dto';
import { UpdateSpotDto } from './dto/update-spot.dto';
import { Spot } from './entities/spot.entity';
import { mapSpot } from './spots.mapper';
import {
  normalizePlaceType,
  normalizeWeekdays,
  resolveName,
  toCyrillicApprox,
} from './spots.shared';
import { SpotView } from './spots.types';

export class SpotAdminService {
  constructor(private readonly spotRepository: Repository<Spot>) {}

  async createSpot(dto: CreateSpotDto): Promise<SpotView> {
    if (
      dto.ticketPriceMinCny !== undefined &&
      dto.ticketPriceMaxCny !== undefined &&
      dto.ticketPriceMaxCny < dto.ticketPriceMinCny
    ) {
      throw new BadRequestException({
        code: 'SPOT_TICKET_PRICE_RANGE_INVALID',
        message:
          'ticketPriceMaxCny must be greater than or equal to ticketPriceMinCny.',
      });
    }
    if (dto.reservationRequired && !dto.reservationUrl?.trim()) {
      throw new BadRequestException({
        code: 'SPOT_RESERVATION_URL_REQUIRED',
        message: 'reservationUrl is required when reservationRequired is true.',
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
    const reservationNoteI18n = {
      'zh-CN': dto.reservationNoteZhCN?.trim() || '',
      'mn-MN': dto.reservationNoteMnMN?.trim() || '',
      'en-US': dto.reservationNoteEn?.trim() || '',
    };
    const hasReservationNote = Object.values(reservationNoteI18n).some(
      (value) => value.length > 0,
    );

    const spot = this.spotRepository.create({
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
      suggestedDurationMinutes: dto.suggestedDurationMinutes,
      reservationRequired: dto.reservationRequired ?? false,
      reservationUrl: dto.reservationUrl?.trim() || null,
      reservationNoteI18n: hasReservationNote ? reservationNoteI18n : null,
      closedWeekdays: normalizeWeekdays(dto.closedWeekdays),
      ticketPriceMinCny:
        dto.ticketPriceMinCny !== undefined
          ? dto.ticketPriceMinCny.toFixed(2)
          : null,
      ticketPriceMaxCny:
        dto.ticketPriceMaxCny !== undefined
          ? dto.ticketPriceMaxCny.toFixed(2)
          : null,
      placeType: normalizePlaceType(dto.placeType),
      isPublished: dto.isPublished ?? true,
    });
    const saved = await this.spotRepository.save(spot);
    return mapSpot(saved, 'zh-CN');
  }

  async updateSpot(spotId: string, dto: UpdateSpotDto): Promise<SpotView> {
    const spot = await this.spotRepository.findOneBy({ id: spotId });
    if (!spot) {
      throw new NotFoundException({
        code: 'SPOT_NOT_FOUND',
        message: 'Spot not found.',
      });
    }

    if (
      dto.nameZhCN !== undefined ||
      dto.nameMnMN !== undefined ||
      dto.nameEn !== undefined
    ) {
      spot.nameI18n = {
        ...((spot.nameI18n as Record<string, string>) ?? {}),
        ...(dto.nameZhCN !== undefined ? { 'zh-CN': dto.nameZhCN.trim() } : {}),
        ...(dto.nameMnMN !== undefined ? { 'mn-MN': dto.nameMnMN.trim() } : {}),
        ...(dto.nameEn !== undefined ? { 'en-US': dto.nameEn.trim() } : {}),
      };
      spot.name = resolveName(spot.nameI18n as Record<string, string>, 'zh-CN');
    }

    const nextReservationRequired =
      dto.reservationRequired ?? spot.reservationRequired ?? false;
    const nextReservationUrl =
      dto.reservationUrl !== undefined
        ? dto.reservationUrl?.trim() || null
        : spot.reservationUrl?.trim() || null;
    if (nextReservationRequired && !nextReservationUrl) {
      throw new BadRequestException({
        code: 'SPOT_RESERVATION_URL_REQUIRED',
        message: 'reservationUrl is required when reservationRequired is true.',
      });
    }

    if (
      dto.province !== undefined ||
      dto.provinceMnMN !== undefined ||
      dto.provinceZhCN !== undefined
    ) {
      const nextProvinceEn = dto.province?.trim() ?? spot.province;
      const provinceI18n = {
        ...((spot.provinceI18n as Record<string, string>) ?? {
          'zh-CN': spot.province,
          'en-US': spot.province,
          'mn-MN': toCyrillicApprox(spot.province),
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
      spot.province = nextProvinceEn;
      spot.provinceI18n = provinceI18n;
    }

    if (
      dto.city !== undefined ||
      dto.cityMnMN !== undefined ||
      dto.cityZhCN !== undefined
    ) {
      const nextCityEn = dto.city?.trim() ?? spot.city;
      const cityI18n = {
        ...((spot.cityI18n as Record<string, string>) ?? {
          'zh-CN': spot.city,
          'en-US': spot.city,
          'mn-MN': toCyrillicApprox(spot.city),
        }),
        ...(dto.city !== undefined ? { 'en-US': nextCityEn } : {}),
        ...(dto.cityZhCN !== undefined ? { 'zh-CN': dto.cityZhCN.trim() } : {}),
        ...(dto.cityMnMN !== undefined ? { 'mn-MN': dto.cityMnMN.trim() } : {}),
      };
      if (dto.city !== undefined && dto.cityMnMN === undefined) {
        cityI18n['mn-MN'] = toCyrillicApprox(nextCityEn);
      }
      spot.city = nextCityEn;
      spot.cityI18n = cityI18n;
    }

    if (dto.latitude !== undefined) {
      spot.latitude = dto.latitude;
    }
    if (dto.longitude !== undefined) {
      spot.longitude = dto.longitude;
    }
    if (dto.coverImageUrl !== undefined) {
      spot.coverImageUrl = dto.coverImageUrl?.trim() || null;
    }
    if (
      dto.introZhCN !== undefined ||
      dto.introMnMN !== undefined ||
      dto.introEn !== undefined
    ) {
      spot.introI18n = {
        ...spot.introI18n,
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
      spot.guideI18n = {
        ...(spot.guideI18n ?? {}),
        ...(dto.guideZhCN !== undefined
          ? { 'zh-CN': dto.guideZhCN.trim() }
          : {}),
        ...(dto.guideMnMN !== undefined
          ? { 'mn-MN': dto.guideMnMN.trim() }
          : {}),
        ...(dto.guideEn !== undefined ? { 'en-US': dto.guideEn.trim() } : {}),
      };
    }
    if (dto.placeType !== undefined) {
      spot.placeType = normalizePlaceType(dto.placeType);
    }
    if (dto.suggestedDurationMinutes !== undefined) {
      spot.suggestedDurationMinutes = dto.suggestedDurationMinutes;
    }
    if (dto.reservationRequired !== undefined) {
      spot.reservationRequired = dto.reservationRequired;
    }
    if (dto.reservationUrl !== undefined) {
      spot.reservationUrl = dto.reservationUrl?.trim() || null;
    }
    if (
      dto.reservationNoteZhCN !== undefined ||
      dto.reservationNoteMnMN !== undefined ||
      dto.reservationNoteEn !== undefined
    ) {
      const nextReservationNoteI18n = {
        ...(spot.reservationNoteI18n ?? {}),
        ...(dto.reservationNoteZhCN !== undefined
          ? { 'zh-CN': dto.reservationNoteZhCN.trim() }
          : {}),
        ...(dto.reservationNoteMnMN !== undefined
          ? { 'mn-MN': dto.reservationNoteMnMN.trim() }
          : {}),
        ...(dto.reservationNoteEn !== undefined
          ? { 'en-US': dto.reservationNoteEn.trim() }
          : {}),
      };
      const hasReservationNote = Object.values(nextReservationNoteI18n).some(
        (value) => typeof value === 'string' && value.trim().length > 0,
      );
      spot.reservationNoteI18n = hasReservationNote
        ? nextReservationNoteI18n
        : null;
    }
    if (dto.closedWeekdays !== undefined) {
      spot.closedWeekdays = normalizeWeekdays(dto.closedWeekdays);
    }
    const nextTicketPriceMinCny =
      dto.ticketPriceMinCny !== undefined
        ? dto.ticketPriceMinCny
        : spot.ticketPriceMinCny === null
          ? null
          : Number(spot.ticketPriceMinCny);
    const nextTicketPriceMaxCny =
      dto.ticketPriceMaxCny !== undefined
        ? dto.ticketPriceMaxCny
        : spot.ticketPriceMaxCny === null
          ? null
          : Number(spot.ticketPriceMaxCny);
    if (
      nextTicketPriceMinCny !== null &&
      nextTicketPriceMaxCny !== null &&
      nextTicketPriceMaxCny < nextTicketPriceMinCny
    ) {
      throw new BadRequestException({
        code: 'SPOT_TICKET_PRICE_RANGE_INVALID',
        message:
          'ticketPriceMaxCny must be greater than or equal to ticketPriceMinCny.',
      });
    }
    if (dto.ticketPriceMinCny !== undefined) {
      spot.ticketPriceMinCny = dto.ticketPriceMinCny.toFixed(2);
    }
    if (dto.ticketPriceMaxCny !== undefined) {
      spot.ticketPriceMaxCny = dto.ticketPriceMaxCny.toFixed(2);
    }
    if (dto.isPublished !== undefined) {
      spot.isPublished = dto.isPublished;
    }

    const saved = await this.spotRepository.save(spot);
    return mapSpot(saved, 'zh-CN');
  }

  async deleteSpot(spotId: string): Promise<void> {
    const result = await this.spotRepository.delete({ id: spotId });
    if ((result.affected ?? 0) === 0) {
      throw new NotFoundException({
        code: 'SPOT_NOT_FOUND',
        message: 'Spot not found.',
      });
    }
  }

  async listAdminSpots(query: ListAdminSpotsQueryDto): Promise<{
    total: number;
    items: SpotView[];
  }> {
    const where: { isPublished?: boolean; placeType?: Spot['placeType'] } = {};
    if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }
    if (query.placeType !== undefined) {
      where.placeType = query.placeType;
    }
    const [items, total] = await this.spotRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit,
      skip: query.offset,
    });

    return {
      total,
      items: items.map((spot) => mapSpot(spot, 'zh-CN')),
    };
  }

  async getAdminSpotById(spotId: string): Promise<SpotView> {
    const spot = await this.spotRepository.findOneBy({ id: spotId });
    if (!spot) {
      throw new NotFoundException({
        code: 'SPOT_NOT_FOUND',
        message: 'Spot not found.',
      });
    }

    return mapSpot(spot, 'zh-CN');
  }
}
