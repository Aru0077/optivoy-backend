import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelPlace } from '../hotels/entities/hotel.entity';
import { LocationAirport } from '../locations/entities/location-airport.entity';
import { RestaurantPlace } from '../restaurants/entities/restaurant.entity';
import { ShoppingPlace } from '../shopping/entities/shopping.entity';
import { Spot } from '../spots/entities/spot.entity';
import { AmapCoordinate, AmapTransitClient } from './amap/amap-transit.client';
import { TransitCachePointType } from './entities/transit-cache.entity';
import { TransitCacheService } from './transit-cache.service';

interface TransitPoint {
  id: string;
  pointType: TransitCachePointType;
  city: string;
  province: string | null;
  latitude: number;
  longitude: number;
}

export interface TransitPointRecomputeInput {
  id: string;
  pointType: TransitCachePointType;
  city: string;
  province?: string | null;
  latitude: number;
  longitude: number;
}

@Injectable()
export class TransitCachePrecomputeService {
  private readonly logger = new Logger(TransitCachePrecomputeService.name);

  constructor(
    @InjectRepository(Spot)
    private readonly spotRepository: Repository<Spot>,
    @InjectRepository(ShoppingPlace)
    private readonly shoppingRepository: Repository<ShoppingPlace>,
    @InjectRepository(RestaurantPlace)
    private readonly restaurantRepository: Repository<RestaurantPlace>,
    @InjectRepository(HotelPlace)
    private readonly hotelRepository: Repository<HotelPlace>,
    @InjectRepository(LocationAirport)
    private readonly airportRepository: Repository<LocationAirport>,
    private readonly transitCacheService: TransitCacheService,
    private readonly amapTransitClient: AmapTransitClient,
  ) {}

  scheduleRecomputeCity(city: string, province?: string | null): void {
    void this.recomputeCity(city, province).catch((error: unknown) => {
      this.logger.warn(
        `Transit precompute failed city=${city} province=${province ?? ''}: ${(error as Error).message}`,
      );
    });
  }

  scheduleRecomputePointNeighborhood(
    point: TransitPointRecomputeInput,
  ): void {
    void this.recomputePointNeighborhood(point).catch((error: unknown) => {
      this.logger.warn(
        `Transit neighborhood precompute failed pointId=${point.id} city=${point.city}: ${(error as Error).message}`,
      );
    });
  }

  async recomputeCity(city: string, province?: string | null): Promise<void> {
    const normalizedCity = city.trim();
    if (!normalizedCity) {
      return;
    }

    if (!this.amapTransitClient.isEnabled()) {
      this.logger.debug(
        `Skip transit precompute because AMAP is disabled city=${normalizedCity}`,
      );
      return;
    }

    const points = await this.loadCityPoints(normalizedCity, province);
    if (points.length < 2) {
      return;
    }

    for (const destination of points) {
      const origins = points.filter((item) => item.id !== destination.id);
      await this.recomputeEdgesToDestination(origins, destination);
    }
  }

  async recomputePointNeighborhood(
    point: TransitPointRecomputeInput,
  ): Promise<void> {
    const normalizedPoint = this.normalizePointInput(point);
    if (!normalizedPoint) {
      return;
    }

    if (!this.amapTransitClient.isEnabled()) {
      this.logger.debug(
        `Skip transit neighborhood precompute because AMAP is disabled city=${normalizedPoint.city}`,
      );
      return;
    }

    const points = await this.loadCityPoints(
      normalizedPoint.city,
      normalizedPoint.province,
    );
    const others = points.filter((item) => !this.isSamePoint(item, normalizedPoint));
    if (others.length === 0) {
      return;
    }

    await this.recomputeEdgesToDestination(
      others,
      normalizedPoint,
    );

    const concurrency = 5;
    for (let i = 0; i < others.length; i += concurrency) {
      const destinations = others.slice(i, i + concurrency);
      await Promise.all(
        destinations.map((destination) =>
          this.recomputeEdgesToDestination(
            [normalizedPoint],
            destination,
          ),
        ),
      );
    }
  }

  private async loadCityPoints(
    city: string,
    province?: string | null,
  ): Promise<TransitPoint[]> {
    const normalizedProvince = province?.trim() || null;

    const [spots, shopping, restaurants, hotels, airports] = await Promise.all([
      this.spotRepository
        .createQueryBuilder('spot')
        .where('spot."isPublished" = true')
        .andWhere('LOWER(spot.city) = LOWER(:city)', { city })
        .andWhere('spot.latitude IS NOT NULL')
        .andWhere('spot.longitude IS NOT NULL')
        .andWhere(
          normalizedProvince
            ? 'LOWER(spot.province) = LOWER(:province)'
            : '1=1',
          normalizedProvince ? { province: normalizedProvince } : {},
        )
        .getMany(),
      this.shoppingRepository
        .createQueryBuilder('shopping')
        .where('shopping."isPublished" = true')
        .andWhere('LOWER(shopping.city) = LOWER(:city)', { city })
        .andWhere('shopping.latitude IS NOT NULL')
        .andWhere('shopping.longitude IS NOT NULL')
        .andWhere(
          normalizedProvince
            ? 'LOWER(shopping.province) = LOWER(:province)'
            : '1=1',
          normalizedProvince ? { province: normalizedProvince } : {},
        )
        .getMany(),
      this.restaurantRepository
        .createQueryBuilder('restaurant')
        .where('restaurant."isPublished" = true')
        .andWhere('LOWER(restaurant.city) = LOWER(:city)', { city })
        .andWhere('restaurant.latitude IS NOT NULL')
        .andWhere('restaurant.longitude IS NOT NULL')
        .andWhere(
          normalizedProvince
            ? 'LOWER(restaurant.province) = LOWER(:province)'
            : '1=1',
          normalizedProvince ? { province: normalizedProvince } : {},
        )
        .getMany(),
      this.hotelRepository
        .createQueryBuilder('hotel')
        .where('hotel."isPublished" = true')
        .andWhere('LOWER(hotel.city) = LOWER(:city)', { city })
        .andWhere('hotel.latitude IS NOT NULL')
        .andWhere('hotel.longitude IS NOT NULL')
        .andWhere(
          normalizedProvince
            ? 'LOWER(hotel.province) = LOWER(:province)'
            : '1=1',
          normalizedProvince ? { province: normalizedProvince } : {},
        )
        .getMany(),
      this.airportRepository
        .createQueryBuilder('airport')
        .leftJoinAndSelect('airport.city', 'city')
        .leftJoinAndSelect('city.province', 'province')
        .where('airport.latitude IS NOT NULL')
        .andWhere('airport.longitude IS NOT NULL')
        .andWhere('LOWER(city.name) = LOWER(:city)', { city })
        .andWhere(
          normalizedProvince
            ? 'LOWER(province.name) = LOWER(:province)'
            : '1=1',
          normalizedProvince ? { province: normalizedProvince } : {},
        )
        .getMany(),
    ]);

    const spotPoints: TransitPoint[] = spots.map((item) => ({
      id: item.id,
      pointType: 'spot',
      city: item.city,
      province: item.province,
      latitude: item.latitude as number,
      longitude: item.longitude as number,
    }));

    const shoppingPoints: TransitPoint[] = shopping.map((item) => ({
      id: item.id,
      pointType: 'shopping',
      city: item.city,
      province: item.province,
      latitude: item.latitude as number,
      longitude: item.longitude as number,
    }));

    const restaurantPoints: TransitPoint[] = restaurants.map((item) => ({
      id: item.id,
      pointType: 'restaurant',
      city: item.city,
      province: item.province,
      latitude: item.latitude as number,
      longitude: item.longitude as number,
    }));

    const hotelPoints: TransitPoint[] = hotels.map((item) => ({
      id: item.id,
      pointType: 'hotel',
      city: item.city,
      province: item.province,
      latitude: item.latitude as number,
      longitude: item.longitude as number,
    }));

    const airportPoints: TransitPoint[] = airports.map((item) => ({
      id: item.id,
      pointType: 'airport',
      city: item.city?.name ?? city,
      province: item.city?.province?.name ?? normalizedProvince,
      latitude: item.latitude as number,
      longitude: item.longitude as number,
    }));

    return [
      ...spotPoints,
      ...shoppingPoints,
      ...restaurantPoints,
      ...hotelPoints,
      ...airportPoints,
    ];
  }

  private toCoordinate(point: TransitPoint): AmapCoordinate {
    return {
      latitude: point.latitude,
      longitude: point.longitude,
    };
  }

  private normalizePointInput(
    point: TransitPointRecomputeInput,
  ): TransitPoint | null {
    const city = point.city.trim();
    if (!city) {
      return null;
    }
    if (
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude)
    ) {
      return null;
    }

    return {
      id: point.id,
      pointType: point.pointType,
      city,
      province: point.province?.trim() || null,
      latitude: point.latitude,
      longitude: point.longitude,
    };
  }

  private isSamePoint(a: TransitPoint, b: TransitPoint): boolean {
    return a.id === b.id && a.pointType === b.pointType;
  }

  private async recomputeEdgesToDestination(
    origins: TransitPoint[],
    destination: TransitPoint,
  ): Promise<void> {
    if (origins.length === 0) {
      return;
    }

    const maxOrigins = this.amapTransitClient.getDistanceMatrixMaxOrigins();
    for (let i = 0; i < origins.length; i += maxOrigins) {
      const originChunk = origins.slice(i, i + maxOrigins);

      const [drivingRows, walkingRows] = await Promise.all([
        this.amapTransitClient.getDistanceMatrixToDestination({
          origins: originChunk.map((item) => this.toCoordinate(item)),
          destination: this.toCoordinate(destination),
          mode: 'driving',
        }),
        this.amapTransitClient.getDistanceMatrixToDestination({
          origins: originChunk.map((item) => this.toCoordinate(item)),
          destination: this.toCoordinate(destination),
          mode: 'walking',
        }),
      ]);

      for (let idx = 0; idx < originChunk.length; idx += 1) {
        const origin = originChunk[idx];
        const driving = drivingRows[idx];
        const walking = walkingRows[idx];
        const transitFallbackMinutes =
          driving?.durationMinutes ?? walking?.durationMinutes ?? null;
        const walkingMeters = walking?.distanceMeters ?? driving?.distanceMeters ?? null;
        const distanceMeters = driving?.distanceMeters ?? walking?.distanceMeters ?? null;

        if (
          transitFallbackMinutes === null ||
          walkingMeters === null ||
          distanceMeters === null
        ) {
          continue;
        }

        const drivingMinutes = driving?.durationMinutes ?? transitFallbackMinutes;
        const transitMinutesCandidates = [
          driving?.durationMinutes,
          walking?.durationMinutes,
        ].filter(
          (item): item is number =>
            typeof item === 'number' && Number.isFinite(item) && item > 0,
        );
        const transitMinutes =
          transitMinutesCandidates.length > 0
            ? Math.min(...transitMinutesCandidates)
            : transitFallbackMinutes;

        await this.transitCacheService.upsertEdge({
          city: destination.city,
          province: destination.province,
          fromPointId: origin.id,
          fromPointType: origin.pointType,
          toPointId: destination.id,
          toPointType: destination.pointType,
          transitMinutes,
          drivingMinutes,
          walkingMeters,
          distanceKm: Number((distanceMeters / 1000).toFixed(3)),
          transitSummary: null,
          transitSummaryI18n: null,
          provider: 'amap',
          status: 'ready',
        });
      }
    }
  }
}
