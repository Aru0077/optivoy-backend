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

export interface AmapTransitResult {
  distanceMeters: number | null;
  durationMinutes: number | null;
  summary: string | null;
  noRoute?: boolean;
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
  private transitQueue: Promise<void> = Promise.resolve();
  private lastTransitRequestAt = 0;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<AmapConfig>('amap') as AmapConfig;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.webApiKey.trim().length > 0;
  }

  getDistanceMatrixMaxOrigins(): number {
    return Math.max(1, this.config.distanceMatrixMaxOrigins || 25);
  }

  getTransitDirectionConcurrency(): number {
    return Math.max(
      1,
      Math.min(5, this.config.transitDirectionConcurrency || 1),
    );
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
    url.searchParams.set(
      'origins',
      input.origins.map((item) => this.toLngLat(item)).join('|'),
    );
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
          durationSeconds !== null
            ? Math.max(1, Math.round(durationSeconds / 60))
            : null,
      };
    });
  }

  async getDirection(input: {
    mode: AmapDirectionMode;
    origin: AmapCoordinate;
    destination: AmapCoordinate;
    city?: string | null;
    cityCandidates?: string[];
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
    return this.getTransitDirection(
      input.origin,
      input.destination,
      this.buildTransitCityCandidates(input.cityCandidates, input.city),
    );
  }

  async getTransitDirectionsToDestination(input: {
    origins: AmapCoordinate[];
    destination: AmapCoordinate;
    city?: string | null;
    cityCandidates?: string[];
    concurrency?: number;
  }): Promise<Array<AmapTransitResult | null>> {
    if (!this.isEnabled()) {
      return input.origins.map(() => null);
    }

    if (input.origins.length === 0) {
      return [];
    }

    const concurrency = Math.max(
      1,
      Math.min(5, input.concurrency ?? this.getTransitDirectionConcurrency()),
    );
    const results = new Array<AmapTransitResult | null>(
      input.origins.length,
    ).fill(null);

    for (let i = 0; i < input.origins.length; i += concurrency) {
      const chunk = input.origins.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (origin) => {
          try {
            return await this.getTransitDirection(
              origin,
              input.destination,
              this.buildTransitCityCandidates(input.cityCandidates, input.city),
            );
          } catch (error) {
            this.logger.warn(
              `Amap transit direction request failed: ${(error as Error).message}`,
            );
            return null;
          }
        }),
      );

      for (let offset = 0; offset < chunkResults.length; offset += 1) {
        results[i + offset] = chunkResults[offset];
      }
    }

    return results;
  }

  private async getDrivingDirection(
    origin: AmapCoordinate,
    destination: AmapCoordinate,
  ): Promise<AmapDirectionResult | null> {
    const url = new URL('https://restapi.amap.com/v5/direction/driving');
    url.searchParams.set('key', this.config.webApiKey);
    url.searchParams.set('origin', this.toLngLat(origin));
    url.searchParams.set('destination', this.toLngLat(destination));

    const body = await this.requestJson<AmapDrivingDirectionResponse>(
      url.toString(),
    );
    if (body.status !== '1') {
      return null;
    }

    const path = body.route?.paths?.[0];
    const distanceMeters = this.toFiniteInt(path?.distance ?? null);
    const durationSeconds = this.toFiniteInt(path?.duration ?? null);
    return {
      distanceMeters,
      durationMinutes:
        durationSeconds !== null
          ? Math.max(1, Math.round(durationSeconds / 60))
          : null,
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

    const body = await this.requestJson<AmapWalkingDirectionResponse>(
      url.toString(),
    );
    if (body.status !== '1') {
      return null;
    }

    const path = body.route?.paths?.[0];
    const distanceMeters = this.toFiniteInt(path?.distance ?? null);
    const durationSeconds = this.toFiniteInt(path?.duration ?? null);
    return {
      distanceMeters,
      durationMinutes:
        durationSeconds !== null
          ? Math.max(1, Math.round(durationSeconds / 60))
          : null,
      summary: 'walking',
    };
  }

  private async getTransitDirection(
    origin: AmapCoordinate,
    destination: AmapCoordinate,
    cityCandidates?: Array<string | null>,
  ): Promise<AmapTransitResult | null> {
    const attempts = this.buildTransitCityCandidates(cityCandidates);
    const failures: string[] = [];

    for (const cityCandidate of attempts) {
      let qpsRetryCount = 0;
      while (qpsRetryCount <= this.config.transitQpsRetryCount) {
        try {
          const url = new URL(
            'https://restapi.amap.com/v3/direction/transit/integrated',
          );
          url.searchParams.set('key', this.config.webApiKey);
          url.searchParams.set('origin', this.toLngLat(origin));
          url.searchParams.set('destination', this.toLngLat(destination));
          url.searchParams.set('extensions', 'base');
          if (cityCandidate) {
            url.searchParams.set('city', cityCandidate);
            url.searchParams.set('cityd', cityCandidate);
          }

          const body =
            await this.requestTransitJson<AmapTransitDirectionResponse>(
              url.toString(),
            );
          if (body.status !== '1') {
            if (
              this.isTransitQpsExceeded(body.info) &&
              qpsRetryCount < this.config.transitQpsRetryCount
            ) {
              qpsRetryCount += 1;
              await this.delay(this.config.transitQpsBackoffMs * qpsRetryCount);
              continue;
            }
            failures.push(
              `city=${cityCandidate ?? '[auto]'} status=${body.status ?? 'unknown'} info=${body.info ?? 'unknown'}`,
            );
            break;
          }

          const transit = body.route?.transits?.[0];
          if (!transit) {
            this.logger.debug(
              `Amap transit no route origin=${this.toLngLat(origin)} destination=${this.toLngLat(destination)} city=${cityCandidate ?? '[auto]'}`,
            );
            return {
              noRoute: true,
              distanceMeters: null,
              durationMinutes: null,
              summary: null,
            };
          }

          const distanceMeters = this.toFiniteInt(transit.distance ?? null);
          const durationSeconds = this.toFiniteInt(transit.duration ?? null);
          const summary = this.buildTransitSummary(transit.segments ?? []);

          return {
            distanceMeters,
            durationMinutes:
              durationSeconds !== null
                ? Math.max(1, Math.round(durationSeconds / 60))
                : null,
            summary,
          };
        } catch (error) {
          failures.push(
            `city=${cityCandidate ?? '[auto]'} request_error=${(error as Error).message}`,
          );
          break;
        }
      }
    }

    if (failures.length > 0) {
      this.logger.warn(
        `Amap transit direction exhausted candidates origin=${this.toLngLat(origin)} destination=${this.toLngLat(destination)} failures=${failures.join(' | ')}`,
      );
    }
    return null;
  }

  private buildTransitCityCandidates(
    cityCandidates?: Array<string | null | undefined>,
    fallbackCity?: string | null,
  ): Array<string | null> {
    const normalized: string[] = [];
    const seen = new Set<string>();

    const push = (value?: string | null) => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return;
      }
      if (!this.isSupportedTransitCityCandidate(trimmed)) {
        return;
      }

      const variants = new Set<string>([trimmed]);
      if (/市$/.test(trimmed)) {
        variants.add(trimmed.replace(/市$/, ''));
      }

      for (const variant of variants) {
        if (!variant || seen.has(variant)) {
          continue;
        }
        seen.add(variant);
        normalized.push(variant);
      }
    };

    for (const city of cityCandidates ?? []) {
      push(city);
    }
    push(fallbackCity);

    return normalized.length > 0 ? normalized : [null];
  }

  private isSupportedTransitCityCandidate(value: string): boolean {
    return /[\u4e00-\u9fff]/.test(value) || /^[A-Za-z0-9\s().\-]+$/.test(value);
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

      const walkingDistance = this.toFiniteInt(
        segment.walking?.distance ?? null,
      );
      if (
        walkingDistance !== null &&
        walkingDistance > 0 &&
        parts.length === 0
      ) {
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
    const timeout = setTimeout(
      () => abortController.abort(),
      this.config.requestTimeoutMs,
    );

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

  private async requestTransitJson<T>(url: string): Promise<T> {
    await this.waitForTransitWindow();
    try {
      return await this.requestJson<T>(url);
    } finally {
      this.lastTransitRequestAt = Date.now();
    }
  }

  private async waitForTransitWindow(): Promise<void> {
    const run = async () => {
      const minInterval = Math.max(
        0,
        this.config.transitRequestMinIntervalMs || 0,
      );
      const waitMs = Math.max(
        0,
        this.lastTransitRequestAt + minInterval - Date.now(),
      );
      if (waitMs > 0) {
        await this.delay(waitMs);
      }
    };

    const ticket = this.transitQueue.then(run, run);
    this.transitQueue = ticket.then(
      () => undefined,
      () => undefined,
    );
    await ticket;
  }

  private isTransitQpsExceeded(info?: string | null): boolean {
    return (info ?? '').toUpperCase().includes('CUQPS_HAS_EXCEEDED_THE_LIMIT');
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
