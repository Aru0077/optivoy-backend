import { NotFoundException } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { ListCityGroupsQueryDto } from './dto/list-city-groups-query.dto';
import { ListSpotsQueryDto, SpotLang } from './dto/list-spots-query.dto';
import { Spot } from './entities/spot.entity';
import { mapRawSpot, mapSpot } from './spots.mapper';
import { CityGroupItem, SpotRawRow, SpotView } from './spots.types';

export class SpotPublicService {
  constructor(
    private readonly spotRepository: Repository<Spot>,
    private readonly dataSource: DataSource,
  ) {}

  async listSpots(query: ListSpotsQueryDto): Promise<{
    total: number;
    items: SpotView[];
  }> {
    const total = await this.countPublishedSpots(query);
    const items = await this.queryPublishedSpots(query);
    return { total, items };
  }

  async listCityGroups(query: ListCityGroupsQueryDto): Promise<{
    total: number;
    items: CityGroupItem[];
  }> {
    const buildBaseQb = () => {
      const qb = this.spotRepository
        .createQueryBuilder('spot')
        .where('spot."isPublished" = true')
        .andWhere("spot.province <> ''")
        .andWhere("spot.city <> ''");

      if (query.province) {
        qb.andWhere('spot.province = :province', {
          province: query.province.trim(),
        });
      }

      return qb;
    };

    const groupedSubQb = buildBaseQb()
      .select('spot.province', 'province')
      .addSelect('spot.city', 'city')
      .addSelect('COUNT(spot.id)', 'spotCount')
      .groupBy('spot.province')
      .addGroupBy('spot.city');

    const [rows, countRow] = await Promise.all([
      groupedSubQb
        .clone()
        .orderBy('"spotCount"', 'DESC')
        .addOrderBy('spot.province', 'ASC')
        .addOrderBy('spot.city', 'ASC')
        .take(query.limit)
        .skip(query.offset)
        .getRawMany<{ province: string; city: string; spotCount: string }>(),
      this.dataSource
        .createQueryBuilder()
        .select('COUNT(*)', 'total')
        .from(`(${groupedSubQb.getQuery()})`, 'sub')
        .setParameters(groupedSubQb.getParameters())
        .getRawOne<{ total: string }>(),
    ]);

    return {
      total: parseInt(countRow?.total ?? '0', 10),
      items: rows.map((row) => ({
        province: row.province,
        city: row.city,
        spotCount: parseInt(row.spotCount, 10),
      })),
    };
  }

  async getSpotById(spotId: string, lang: SpotLang): Promise<SpotView> {
    const spot = await this.spotRepository.findOneBy({
      id: spotId,
      isPublished: true,
    });
    if (!spot) {
      throw new NotFoundException({
        code: 'SPOT_NOT_FOUND',
        message: 'Spot not found.',
      });
    }

    return mapSpot(spot, lang);
  }

  private async countPublishedSpots(query: ListSpotsQueryDto): Promise<number> {
    const qb = this.spotRepository
      .createQueryBuilder('spot')
      .where('spot."isPublished" = true');
    this.applyPublicFilters(qb, query);
    return qb.getCount();
  }

  private async queryPublishedSpots(
    query: ListSpotsQueryDto,
  ): Promise<SpotView[]> {
    const qb = this.spotRepository
      .createQueryBuilder('spot')
      .where('spot."isPublished" = true');

    this.applyPublicFilters(qb, query);

    qb.select(this.baseSpotSelects())
      .orderBy('spot."createdAt"', 'DESC')
      .take(query.limit)
      .skip(query.offset);

    const rows = await qb.getRawMany<SpotRawRow>();
    return rows.map((row) => mapRawSpot(row, query.lang));
  }

  private applyPublicFilters(
    qb: SelectQueryBuilder<Spot>,
    query: ListSpotsQueryDto,
  ): void {
    if (query.province) {
      qb.andWhere('spot.province ILIKE :province', {
        province: `%${query.province.trim()}%`,
      });
    }
    if (query.city) {
      qb.andWhere('spot.city ILIKE :city', { city: `%${query.city.trim()}%` });
    }
  }

  private baseSpotSelects(): string[] {
    return [
      'spot.id AS "id"',
      'spot.name AS "name"',
      'spot."nameI18n" AS "nameI18n"',
      'spot.country AS "country"',
      'spot.province AS "province"',
      'spot."provinceI18n" AS "provinceI18n"',
      'spot.city AS "city"',
      'spot."cityI18n" AS "cityI18n"',
      'spot.latitude AS "latitude"',
      'spot.longitude AS "longitude"',
      'spot."entryLatitude" AS "entryLatitude"',
      'spot."entryLongitude" AS "entryLongitude"',
      'spot."exitLatitude" AS "exitLatitude"',
      'spot."exitLongitude" AS "exitLongitude"',
      'spot."coverImageUrl" AS "coverImageUrl"',
      'spot."introI18n" AS "introI18n"',
      'spot."guideI18n" AS "guideI18n"',
      'spot."noticeI18n" AS "noticeI18n"',
      'spot."suggestedDurationMinutes" AS "suggestedDurationMinutes"',
      'spot."reservationRequired" AS "reservationRequired"',
      'spot."reservationUrl" AS "reservationUrl"',
      'spot."reservationNoteI18n" AS "reservationNoteI18n"',
      'spot."closedWeekdays" AS "closedWeekdays"',
      'spot."ticketPriceMinCny" AS "ticketPriceMinCny"',
      'spot."ticketPriceMaxCny" AS "ticketPriceMaxCny"',
      'spot."isPublished" AS "isPublished"',
      'spot."createdAt" AS "createdAt"',
      'spot."updatedAt" AS "updatedAt"',
    ];
  }
}
