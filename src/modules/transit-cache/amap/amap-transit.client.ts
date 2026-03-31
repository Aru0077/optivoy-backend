import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmapConfig } from '../../../config/amap.config';

export interface AmapCoordinate {
  latitude: number;
  longitude: number;
}

export type AmapMatrixMode = 'driving' | 'walking';
export type AmapDirectionMode = 'transit' | 'driving' | 'walking';

export interface AmapMatrixItem {
  distanceMeters: number | null;
  durationMinutes: number | null;
}

export interface AmapDirectionResult {
  distanceMeters: number | null;
  durationMinutes: number | null;
  summary: string | null;
}

interface AmapMatrixResponse {
  status?: string;
  info?: string;
  results?: Array<{
    distance?: string;
    duration?: string;
  }>;
}

interface AmapDrivingDirectionResponse {
  status?: string;
  info?: string;
  route?: {
    paths?: Array<{
      distance?: string;
      duration?: string;
      strategy?: string;
    }>;
  };
}

interface AmapWalkingDirectionResponse {
  status?: string;
  info?: string;
  route?: {
    paths?: Array<{
      distance?: string;
      duration?: string;
    }>;
  };
}

interface AmapTransitDirectionResponse {
  status?: string;
  info?: string;
  route?: {
    transits?: Array<{
      duration?: string;
      distance?: string;
      segments?: Array<{
        walking?: { distance?: string };
        bus?: {
          buslines?: Array<{
            name?: string;
          }>;
        };
        railway?: {
          name?: string;
        };
      }>;
    }>;
  };
}

@Injectable()
export class AmapTransitClient {
  private readonly logger = new Logger(AmapTransitClient.name);
  private readonly config: AmapConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<AmapConfig>('amap') as AmapConfig;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.webApiKey.trim().length > 0;
  }

  getDistanceMatrixMaxOrigins(): number {
    return Math.max(1, this.config.distanceMatrixMaxOrigins || 25);
  }

  async getDistanceMatrixToDestination(input: {
    origins: AmapCoordinate[];
    destination: AmapCoordinate;
    mode: AmapMatrixMode;
  }): Promise<AmapMatrixItem[]> {
    if (!this.isEnabled()) {
      return input.origins.map(() => ({
        distanceMeters: null,
        durationMinutes: null,
      }));
    }

    if (input.origins.length === 0) {
      return [];
    }

    const url = new URL('https://restapi.amap.com/v3/distance');
    url.searchParams.set('key', this.config.webApiKey);
    url.searchParams.set('origins', input.origins.map((item) => this.toLngLat(item)).join('|'));
    url.searchParams.set('destination', this.toLngLat(input.destination));
    url.searchParams.set('type', input.mode === 'walking' ? '3' : '1');

    const body = await this.requestJson<AmapMatrixResponse>(url.toString());
    if (body.status !== '1') {
      this.logger.warn(
        `Amap matrix request failed info=${body.info ?? 'unknown'} mode=${input.mode}`,
      );
      return input.origins.map(() => ({
        distanceMeters: null,
        durationMinutes: null,
      }));
    }

    const rows = body.results ?? [];
    return input.origins.map((_, index) => {
      const row = rows[index];
      const distanceMeters = this.toFiniteInt(row?.distance ?? null);
      const durationSeconds = this.toFiniteInt(row?.duration ?? null);
      return {
        distanceMeters,
        durationMinutes:
          durationSeconds !== null ? Math.max(1, Math.round(durationSeconds / 60)) : null,
      };
    });
  }

  async getDirection(input: {
    mode: AmapDirectionMode;
    origin: AmapCoordinate;
    destination: AmapCoordinate;
    city?: string | null;
  }): Promise<AmapDirectionResult | null> {
    if (!this.isEnabled()) {
      return null;
    }

    if (input.mode === 'driving') {
      return this.getDrivingDirection(input.origin, input.destination);
    }
    if (input.mode === 'walking') {
      return this.getWalkingDirection(input.origin, input.destination);
    }
    return this.getTransitDirection(input.origin, input.destination, input.city);
  }

  private async getDrivingDirection(
    origin: AmapCoordinate,
    destination: AmapCoordinate,
  ): Promise<AmapDirectionResult | null> {
    const url = new URL('https://restapi.amap.com/v5/direction/driving');
    url.searchParams.set('key', this.config.webApiKey);
    url.searchParams.set('origin', this.toLngLat(origin));
    url.searchParams.set('destination', this.toLngLat(destination));

    const body = await this.requestJson<AmapDrivingDirectionResponse>(url.toString());
    if (body.status !== '1') {
      return null;
    }

    const path = body.route?.paths?.[0];
    const distanceMeters = this.toFiniteInt(path?.distance ?? null);
    const durationSeconds = this.toFiniteInt(path?.duration ?? null);
    return {
      distanceMeters,
      durationMinutes:
        durationSeconds !== null ? Math.max(1, Math.round(durationSeconds / 60)) : null,
      summary: path?.strategy?.trim() || null,
    };
  }

  private async getWalkingDirection(
    origin: AmapCoordinate,
    destination: AmapCoordinate,
  ): Promise<AmapDirectionResult | null> {
    const url = new URL('https://restapi.amap.com/v5/direction/walking');
    url.searchParams.set('key', this.config.webApiKey);
    url.searchParams.set('origin', this.toLngLat(origin));
    url.searchParams.set('destination', this.toLngLat(destination));

    const body = await this.requestJson<AmapWalkingDirectionResponse>(url.toString());
    if (body.status !== '1') {
      return null;
    }

    const path = body.route?.paths?.[0];
    const distanceMeters = this.toFiniteInt(path?.distance ?? null);
    const durationSeconds = this.toFiniteInt(path?.duration ?? null);
    return {
      distanceMeters,
      durationMinutes:
        durationSeconds !== null ? Math.max(1, Math.round(durationSeconds / 60)) : null,
      summary: 'walking',
    };
  }

  private async getTransitDirection(
    origin: AmapCoordinate,
    destination: AmapCoordinate,
    city?: string | null,
  ): Promise<AmapDirectionResult | null> {
    const url = new URL('https://restapi.amap.com/v5/direction/transit/integrated');
    url.searchParams.set('key', this.config.webApiKey);
    url.searchParams.set('origin', this.toLngLat(origin));
    url.searchParams.set('destination', this.toLngLat(destination));
    if (city?.trim()) {
      url.searchParams.set('city1', city.trim());
      url.searchParams.set('city2', city.trim());
    }

    const body = await this.requestJson<AmapTransitDirectionResponse>(url.toString());
    if (body.status !== '1') {
      return null;
    }

    const transit = body.route?.transits?.[0];
    if (!transit) {
      return null;
    }

    const distanceMeters = this.toFiniteInt(transit.distance ?? null);
    const durationSeconds = this.toFiniteInt(transit.duration ?? null);
    const summary = this.buildTransitSummary(transit.segments ?? []);

    return {
      distanceMeters,
      durationMinutes:
        durationSeconds !== null ? Math.max(1, Math.round(durationSeconds / 60)) : null,
      summary,
    };
  }

  private buildTransitSummary(
    segments: Array<{
      walking?: { distance?: string };
      bus?: { buslines?: Array<{ name?: string }> };
      railway?: { name?: string };
    }>,
  ): string | null {
    const parts: string[] = [];
    for (const segment of segments) {
      const lineName = segment.bus?.buslines?.[0]?.name?.trim();
      if (lineName) {
        parts.push(lineName);
      }

      const railwayName = segment.railway?.name?.trim();
      if (railwayName) {
        parts.push(railwayName);
      }

      const walkingDistance = this.toFiniteInt(segment.walking?.distance ?? null);
      if (walkingDistance !== null && walkingDistance > 0 && parts.length === 0) {
        parts.push('walking');
      }
    }

    if (parts.length === 0) {
      return null;
    }
    return Array.from(new Set(parts)).join(' -> ');
  }

  private toLngLat(point: AmapCoordinate): string {
    return `${point.longitude},${point.latitude}`;
  }

  private toFiniteInt(value: string | number | null): number | null {
    if (value === null) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.round(value) : null;
    }
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  private async requestJson<T>(url: string): Promise<T> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.config.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: abortController.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
