import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { ListLocationAirportsQueryDto } from './dto/list-location-airports-query.dto';
import { ListLocationCitiesQueryDto } from './dto/list-location-cities-query.dto';
import { ListLocationCountriesQueryDto } from './dto/list-location-countries-query.dto';
import { ListLocationProvincesQueryDto } from './dto/list-location-provinces-query.dto';
import { LocationAirport } from './entities/location-airport.entity';
import { LocationCity } from './entities/location-city.entity';
import { LocationCountryRef } from './entities/location-country-ref.entity';
import { LocationProvince } from './entities/location-province.entity';
import {
  PointMatrixStatusSummary,
  TransitCacheService,
} from '../transit-cache/transit-cache.service';

export interface LocationCountryView {
  code: string;
  name: string;
}

export interface LocationProvinceView {
  id: string;
  country: string;
  name: string;
  nameI18n: Record<string, string>;
}

export interface LocationCityView {
  id: string;
  provinceId: string;
  country: string;
  province: string;
  provinceI18n: Record<string, string>;
  name: string;
  nameI18n: Record<string, string>;
}

export interface LocationAirportView {
  id: string;
  airportCode: string;
  name: string;
  nameI18n: Record<string, string>;
  latitude: number | null;
  longitude: number | null;
  arrivalBufferMinutes: number | null;
  departureBufferMinutes: number | null;
  arrivalAnchorLatitude: number | null;
  arrivalAnchorLongitude: number | null;
  departureAnchorLatitude: number | null;
  departureAnchorLongitude: number | null;
  country: string;
  province: string;
  provinceI18n: Record<string, string>;
  city: string;
  cityI18n: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminPointMatrixStatusView extends PointMatrixStatusSummary {}

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(LocationCountryRef)
    private readonly countryRepository: Repository<LocationCountryRef>,
    @InjectRepository(LocationProvince)
    private readonly provinceRepository: Repository<LocationProvince>,
    @InjectRepository(LocationCity)
    private readonly cityRepository: Repository<LocationCity>,
    @InjectRepository(LocationAirport)
    private readonly airportRepository: Repository<LocationAirport>,
    private readonly transitCacheService: TransitCacheService,
  ) {}

  async listCountries(query: ListLocationCountriesQueryDto): Promise<{
    total: number;
    items: LocationCountryView[];
  }> {
    const [items, total] = await this.countryRepository.findAndCount({
      where: [{ code: 'CN' }, { code: 'MN' }],
      order: { name: 'ASC' },
      take: query.limit,
      skip: query.offset,
    });

    return {
      total,
      items: items.map((item) => ({
        code: item.code,
        name: item.name,
      })),
    };
  }

  async listProvinces(query: ListLocationProvincesQueryDto): Promise<{
    total: number;
    items: LocationProvinceView[];
  }> {
    const qb = this.provinceRepository.createQueryBuilder('province');

    if (query.country) {
      qb.where('province.country = :country', {
        country: query.country.trim(),
      });
    }
    if (query.q) {
      qb.andWhere(
        '(province.name ILIKE :q OR CAST(province."nameI18n" AS TEXT) ILIKE :q)',
        { q: `%${query.q.trim()}%` },
      );
    }

    const [items, total] = await qb
      .orderBy('province.country', 'ASC')
      .addOrderBy('province.name', 'ASC')
      .take(query.limit)
      .skip(query.offset)
      .getManyAndCount();

    return {
      total,
      items: items.map((item) => this.mapProvince(item)),
    };
  }

  async listCities(query: ListLocationCitiesQueryDto): Promise<{
    total: number;
    items: LocationCityView[];
  }> {
    const [items, total] = await this.buildCityListQuery(query)
      .orderBy('province.country', 'ASC')
      .addOrderBy('province.name', 'ASC')
      .addOrderBy('city.name', 'ASC')
      .take(query.limit)
      .skip(query.offset)
      .getManyAndCount();

    return {
      total,
      items: items.map((item) => this.mapCity(item)),
    };
  }

  async listAirports(query: ListLocationAirportsQueryDto): Promise<{
    total: number;
    items: LocationAirportView[];
  }> {
    const [items, total] = await this.buildAirportListQuery(query)
      .orderBy('province.country', 'ASC')
      .addOrderBy('province.name', 'ASC')
      .addOrderBy('city.name', 'ASC')
      .addOrderBy('airport.airportCode', 'ASC')
      .take(query.limit)
      .skip(query.offset)
      .getManyAndCount();

    return {
      total,
      items: items.map((item) => this.mapAirport(item)),
    };
  }

  async deleteAirportById(airportId: string): Promise<{ success: true }> {
    const airport = await this.airportRepository.findOne({
      where: { id: airportId },
    });
    if (!airport) {
      throw new NotFoundException({
        code: 'LOCATION_AIRPORT_NOT_FOUND',
        message: 'Airport not found.',
      });
    }

    try {
      await this.airportRepository.remove(airport);
      return { success: true };
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as { code?: string };
        if (driverError?.code === '23503') {
          throw new ConflictException({
            code: 'LOCATION_AIRPORT_IN_USE',
            message: 'Airport is referenced by spots and cannot be deleted.',
          });
        }
      }
      throw error;
    }
  }

  async getPointMatrixStatuses(pointIdsRaw: string): Promise<{
    items: AdminPointMatrixStatusView[];
  }> {
    const pointIds = this.parsePointIds(pointIdsRaw);
    const summaryMap =
      await this.transitCacheService.getPointMatrixStatuses(pointIds);
    return {
      items: pointIds.map((pointId) => summaryMap[pointId]),
    };
  }

  private buildCityListQuery(
    query: ListLocationCitiesQueryDto,
  ): SelectQueryBuilder<LocationCity> {
    const qb = this.cityRepository
      .createQueryBuilder('city')
      .leftJoinAndSelect('city.province', 'province');

    if (query.country) {
      qb.where('province.country = :country', {
        country: query.country.trim(),
      });
    }
    if (query.province) {
      qb.andWhere('province.name = :province', {
        province: query.province.trim(),
      });
    }
    if (query.provinceId) {
      qb.andWhere('province.id = :provinceId', {
        provinceId: query.provinceId.trim(),
      });
    }
    if (query.q) {
      qb.andWhere(
        '(city.name ILIKE :q OR CAST(city."nameI18n" AS TEXT) ILIKE :q)',
        { q: `%${query.q.trim()}%` },
      );
    }

    return qb;
  }

  private buildAirportListQuery(
    query: ListLocationAirportsQueryDto,
  ): SelectQueryBuilder<LocationAirport> {
    const qb = this.airportRepository
      .createQueryBuilder('airport')
      .distinct(true)
      .leftJoinAndSelect('airport.city', 'city')
      .leftJoinAndSelect('city.province', 'province');

    if (query.country) {
      qb.where('province.country = :country', {
        country: query.country.trim(),
      });
    }
    if (query.province) {
      qb.andWhere('province.name = :province', {
        province: query.province.trim(),
      });
    }
    if (query.city) {
      qb.andWhere('city.name = :city', {
        city: query.city.trim(),
      });
    }
    if (query.q) {
      qb.andWhere(
        `(
          airport."airportCode" ILIKE :q
          OR airport.name ILIKE :q
          OR CAST(airport."nameI18n" AS TEXT) ILIKE :q
          OR city.name ILIKE :q
          OR CAST(city."nameI18n" AS TEXT) ILIKE :q
          OR province.name ILIKE :q
          OR CAST(province."nameI18n" AS TEXT) ILIKE :q
        )`,
        { q: `%${query.q.trim()}%` },
      );
    }

    return qb;
  }

  private mapProvince(province: LocationProvince): LocationProvinceView {
    return {
      id: province.id,
      country: province.country,
      name: province.name,
      nameI18n: this.ensureI18n(province.nameI18n, province.name),
    };
  }

  private mapCity(city: LocationCity | null): LocationCityView {
    if (!city || !city.province) {
      throw new NotFoundException({
        code: 'LOCATION_CITY_NOT_FOUND',
        message: 'City not found.',
      });
    }
    return {
      id: city.id,
      provinceId: city.provinceId,
      country: city.province.country,
      province: city.province.name,
      provinceI18n: this.ensureI18n(city.province.nameI18n, city.province.name),
      name: city.name,
      nameI18n: this.ensureI18n(city.nameI18n, city.name),
    };
  }

  private mapAirport(airport: LocationAirport | null): LocationAirportView {
    if (!airport || !airport.city || !airport.city.province) {
      throw new NotFoundException({
        code: 'LOCATION_AIRPORT_NOT_FOUND',
        message: 'Airport not found.',
      });
    }
    const provinceName = airport.city.province.name;
    const cityName = airport.city.name;
    return {
      id: airport.id,
      airportCode: airport.airportCode,
      name: airport.name,
      nameI18n: this.ensureI18n(airport.nameI18n, airport.name),
      latitude: airport.latitude ?? null,
      longitude: airport.longitude ?? null,
      arrivalBufferMinutes: airport.arrivalBufferMinutes ?? null,
      departureBufferMinutes: airport.departureBufferMinutes ?? null,
      arrivalAnchorLatitude: airport.arrivalAnchorLatitude ?? null,
      arrivalAnchorLongitude: airport.arrivalAnchorLongitude ?? null,
      departureAnchorLatitude: airport.departureAnchorLatitude ?? null,
      departureAnchorLongitude: airport.departureAnchorLongitude ?? null,
      country: airport.city.province.country,
      province: provinceName,
      provinceI18n: this.ensureI18n(
        airport.city.province.nameI18n,
        provinceName,
      ),
      city: cityName,
      cityI18n: this.ensureI18n(airport.city.nameI18n, cityName),
      createdAt: airport.createdAt,
      updatedAt: airport.updatedAt,
    };
  }

  private ensureI18n(
    i18n: Record<string, string | undefined> | null,
    fallbackEn: string,
  ): Record<string, string> {
    const en = i18n?.['en-US']?.trim() || fallbackEn;
    const mn = i18n?.['mn-MN']?.trim() || en;
    const zh = i18n?.['zh-CN']?.trim() || en;
    return {
      'zh-CN': zh,
      'en-US': en,
      'mn-MN': mn,
    };
  }

  private parsePointIds(pointIdsRaw: string): string[] {
    return Array.from(
      new Set(
        (pointIdsRaw || '')
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    ).slice(0, 1000);
  }
}
