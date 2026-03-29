import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppRedisClient,
  createAppRedisClient,
} from '../../common/redis/redis-client.factory';
import { AppConfig } from '../../config/app.config';
import { RedisConfig } from '../../config/redis.config';
import { UserStatus } from './entities/user.entity';
import { UsersService } from './users.service';

interface CachedUserStatus {
  status: UserStatus;
  reason: string | null;
}

interface MemoryCacheEntry {
  expiresAt: number;
  value: CachedUserStatus | null;
}

const USER_STATUS_CACHE_TTL_SECONDS = 60;

@Injectable()
export class UserStatusCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserStatusCacheService.name);
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();
  private redisClient: AppRedisClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redis = this.configService.get<RedisConfig>('redis');
    const app = this.configService.get<AppConfig>('app');
    if (!redis?.enabled) {
      return;
    }

    const client = createAppRedisClient({
      host: redis.host,
      port: redis.port,
      password: redis.password || undefined,
      db: redis.db,
    });

    try {
      await client.connect();
      await client.ping();
      this.redisClient = client;
    } catch (error) {
      this.logger.warn(
        `Redis unavailable, fallback to in-memory user status cache: ${(error as Error).message}`,
      );
      await client.disconnect().catch(() => undefined);
      if (app?.nodeEnv === 'production') {
        throw error;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redisClient) {
      return;
    }
    await this.redisClient.quit().catch(() => undefined);
    this.redisClient = null;
  }

  async assertActive(userId: string): Promise<void> {
    const cached = await this.getUserStatus(userId);
    if (!cached) {
      throw new UnauthorizedException('Account is inactive or not found');
    }
    if (cached.status === UserStatus.Active) {
      return;
    }

    throw new ForbiddenException({
      code: 'USER_DISABLED',
      message:
        cached.status === UserStatus.Banned
          ? 'This account has been banned.'
          : 'This account is suspended.',
      status: cached.status,
      reason: cached.reason,
    });
  }

  async getUserStatus(userId: string): Promise<CachedUserStatus | null> {
    const now = Date.now();
    const memoryHit = this.memoryCache.get(userId);
    if (memoryHit && memoryHit.expiresAt > now) {
      return memoryHit.value;
    }
    if (memoryHit) {
      this.memoryCache.delete(userId);
    }

    const redisHit = await this.readFromRedis(userId);
    if (redisHit.hit) {
      this.setMemory(userId, redisHit.value);
      return redisHit.value;
    }

    const user = await this.usersService.findById(userId);
    const value = user
      ? {
          status: user.status,
          reason: user.statusReason,
        }
      : null;

    this.setMemory(userId, value);
    await this.writeToRedis(userId, value);
    return value;
  }

  private setMemory(userId: string, value: CachedUserStatus | null): void {
    this.memoryCache.set(userId, {
      expiresAt: Date.now() + USER_STATUS_CACHE_TTL_SECONDS * 1000,
      value,
    });
  }

  private async readFromRedis(
    userId: string,
  ): Promise<{ hit: boolean; value: CachedUserStatus | null }> {
    if (!this.redisClient) {
      return { hit: false, value: null };
    }

    try {
      const raw = await this.redisClient.get(this.buildCacheKey(userId));
      if (raw === null) {
        return { hit: false, value: null };
      }
      if (raw === '__missing__') {
        return { hit: true, value: null };
      }

      const parsed = JSON.parse(raw) as CachedUserStatus;
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.status === 'string'
      ) {
        return { hit: true, value: parsed };
      }
    } catch (error) {
      this.logger.warn(
        `Failed to read user status cache for ${userId}: ${(error as Error).message}`,
      );
    }

    return { hit: false, value: null };
  }

  private async writeToRedis(
    userId: string,
    value: CachedUserStatus | null,
  ): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      await this.redisClient.set(
        this.buildCacheKey(userId),
        value ? JSON.stringify(value) : '__missing__',
        {
          EX: USER_STATUS_CACHE_TTL_SECONDS,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to write user status cache for ${userId}: ${(error as Error).message}`,
      );
    }
  }

  private buildCacheKey(userId: string): string {
    return `auth:user-status:${userId}`;
  }
}
