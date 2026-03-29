import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/app.config';
import { RedisConfig } from '../../../config/redis.config';
import { MemoryRateLimitStore } from './memory-rate-limit.store';
import { RateLimitStore } from './rate-limit.store';
import { RedisRateLimitStore } from './redis-rate-limit.store';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly memoryStore = new MemoryRateLimitStore();
  private store: RateLimitStore = this.memoryStore;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redis = this.configService.get<RedisConfig>('redis');
    const app = this.configService.get<AppConfig>('app');
    if (!redis?.enabled) {
      this.logger.log('Redis rate limit disabled, using in-memory store');
      return;
    }

    const redisStore = new RedisRateLimitStore({
      host: redis.host,
      port: redis.port,
      password: redis.password || undefined,
      db: redis.db,
    });

    try {
      await redisStore.connect();
      await redisStore.ttl('__optivoy_rate_limit_probe__');
      this.store = redisStore;
      this.logger.log(
        `Redis rate limit enabled at ${redis.host}:${redis.port}`,
      );
    } catch (error) {
      this.logger.warn(
        `Redis unavailable, fallback to in-memory rate limit: ${(error as Error).message}`,
      );
      if (app?.nodeEnv === 'production') {
        throw error;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.store.close?.();
  }

  async consumeLoginAttempt(
    scope: 'user' | 'admin',
    email: string,
    ip: string,
    maxAttempts: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const ipEmailKey = this.buildLoginKey(scope, email, ip);
    // Global per-email key catches distributed attacks across many IPs.
    // Limit is 3× the per-IP cap to allow legitimate multi-device usage.
    const emailKey = this.buildEmailOnlyKey(scope, email);
    const emailMaxAttempts = maxAttempts * 3;

    const [ipEmailResult, emailResult] = await Promise.all([
      this.consumeKey(ipEmailKey, maxAttempts, windowSeconds),
      this.consumeKey(emailKey, emailMaxAttempts, windowSeconds),
    ]);

    if (!ipEmailResult.allowed) {
      return ipEmailResult;
    }

    if (!emailResult.allowed) {
      return emailResult;
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(
        Math.min(ipEmailResult.remaining, emailResult.remaining),
        0,
      ),
    };
  }

  async resetLoginAttempt(
    scope: 'user' | 'admin',
    email: string,
    ip: string,
  ): Promise<void> {
    await Promise.all([
      this.resetKey(this.buildLoginKey(scope, email, ip)),
      this.resetKey(this.buildEmailOnlyKey(scope, email)),
    ]);
  }

  async consumeKey(
    key: string,
    maxAttempts: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const count = await this.store.increment(key, windowSeconds);
    if (count > maxAttempts) {
      const ttl = await this.store.ttl(key);
      return {
        allowed: false,
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(maxAttempts - count, 0),
    };
  }

  async resetKey(key: string): Promise<void> {
    await this.store.del(key);
  }

  private buildLoginKey(
    scope: 'user' | 'admin',
    email: string,
    ip: string,
  ): string {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedIp = ip || 'unknown';
    return `rate:login:${scope}:${normalizedIp}:${normalizedEmail}`;
  }

  private buildEmailOnlyKey(scope: 'user' | 'admin', email: string): string {
    const normalizedEmail = email.trim().toLowerCase();
    return `rate:login:${scope}:email:${normalizedEmail}`;
  }
}
