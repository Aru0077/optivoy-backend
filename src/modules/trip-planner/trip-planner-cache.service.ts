import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

@Injectable()
export class TripPlannerCacheService {
  private static readonly TTL_MS = 5 * 60 * 1000;
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(
    key: string,
    value: T,
    ttlMs: number = TripPlannerCacheService.TTL_MS,
  ) {
    this.store.set(key, {
      expiresAt: Date.now() + ttlMs,
      value,
    });
  }

  remember<T>(key: string, producer: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return Promise.resolve(cached);
    }
    return producer().then((value) => {
      this.set(key, value);
      return value;
    });
  }

  invalidateAll(): void {
    this.store.clear();
  }
}
