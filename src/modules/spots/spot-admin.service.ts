import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  BasePlaceService,
  BasePlaceUpdatePayload,
} from '../../common/services/base-place.service';
import { ensureReservationNoteI18n } from '../../common/utils/content-i18n.util';
import { CreateSpotDto } from './dto/create-spot.dto';
import { ListAdminSpotsQueryDto } from './dto/list-admin-spots-query.dto';
import { UpdateSpotDto } from './dto/update-spot.dto';
import { Spot } from './entities/spot.entity';
import { mapSpot } from './spots.mapper';
import { normalizeWeekdays } from './spots.shared';
import { SpotView } from './spots.types';

export class SpotAdminService extends BasePlaceService<Spot> {
  constructor(private readonly spotRepository: Repository<Spot>) {
    super();
  }

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

    const reservationNoteI18n = {
      'zh-CN': dto.reservationNoteZhCN?.trim() || '',
      'mn-MN': dto.reservationNoteMnMN?.trim() || '',
      'en-US': dto.reservationNoteEn?.trim() || '',
    };
    const hasReservationNote = Object.values(reservationNoteI18n).some(
      (value) => value.length > 0,
    );

    const spot = this.spotRepository.create({
      ...this.buildBaseCreatePayload(dto),
      suggestedDurationMinutes: dto.suggestedDurationMinutes,
      reservationRequired: dto.reservationRequired ?? false,
      reservationUrl: dto.reservationUrl?.trim() || null,
      reservationNoteI18n: hasReservationNote ? reservationNoteI18n : null,
      closedWeekdays: normalizeWeekdays(dto.closedWeekdays),
      ticketPriceMinCny: dto.ticketPriceMinCny ?? null,
      ticketPriceMaxCny: dto.ticketPriceMaxCny ?? null,
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

    this.applyBaseUpdates(spot, dto as BasePlaceUpdatePayload);

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
        ...ensureReservationNoteI18n(spot.reservationNoteI18n),
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
        : spot.ticketPriceMinCny;
    const nextTicketPriceMaxCny =
      dto.ticketPriceMaxCny !== undefined
        ? dto.ticketPriceMaxCny
        : spot.ticketPriceMaxCny;

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
      spot.ticketPriceMinCny = dto.ticketPriceMinCny;
    }
    if (dto.ticketPriceMaxCny !== undefined) {
      spot.ticketPriceMaxCny = dto.ticketPriceMaxCny;
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
    const qb = this.spotRepository
      .createQueryBuilder('spot')
      .orderBy('spot."createdAt"', 'DESC');

    if (query.isPublished !== undefined) {
      qb.andWhere('spot."isPublished" = :isPublished', {
        isPublished: query.isPublished,
      });
    }
    if (query.province) {
      qb.andWhere('spot.province ILIKE :province', {
        province: `%${query.province}%`,
      });
    }
    if (query.city) {
      qb.andWhere('spot.city ILIKE :city', {
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
