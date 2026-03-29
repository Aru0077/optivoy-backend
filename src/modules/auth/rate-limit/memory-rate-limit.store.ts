import { RateLimitStore } from './rate-limit.store';

interface MemoryCounter {
  count: number;
  expiresAt: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private static readonly MAX_KEYS = 10_000;
  private static readonly GC_INTERVAL = 100;

  private readonly map = new Map<string, MemoryCounter>();
  private writes = 0;

  increment(key: string, ttlSeconds: number): Promise<number> {
    const now = Date.now();
    const existing = this.map.get(key);

    this.writes += 1;
    if (this.writes % MemoryRateLimitStore.GC_INTERVAL === 0) {
      this.cleanupExpired(now);
    }

    if (!existing || existing.expiresAt <= now) {
      if (!existing && this.map.size >= MemoryRateLimitStore.MAX_KEYS) {
        this.evictOne();
      }
      this.map.set(key, {
        count: 1,
        expiresAt: now + ttlSeconds * 1000,
      });
      return Promise.resolve(1);
    }

    existing.count += 1;
    return Promise.resolve(existing.count);
  }

  ttl(key: string): Promise<number> {
    const now = Date.now();
    const existing = this.map.get(key);
    if (!existing || existing.expiresAt <= now) {
      this.map.delete(key);
      return Promise.resolve(-1);
    }

    return Promise.resolve(Math.ceil((existing.expiresAt - now) / 1000));
  }

  del(key: string): Promise<void> {
    this.map.delete(key);
    return Promise.resolve();
  }

  private cleanupExpired(now: number): void {
    for (const [key, counter] of this.map.entries()) {
      if (counter.expiresAt <= now) {
        this.map.delete(key);
      }
    }
  }

  private evictOne(): void {
    const oldest = this.map.keys().next();
    if (!oldest.done) {
      this.map.delete(oldest.value);
    }
  }
}
