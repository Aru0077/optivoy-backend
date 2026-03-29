import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppRedisClient,
  createAppRedisClient,
} from '../../common/redis/redis-client.factory';
import { AppConfig } from '../../config/app.config';
import { RedisConfig } from '../../config/redis.config';

interface MemoryBlacklistEntry {
  expiresAt: number;
}

@Injectable()
export class AccessTokenBlacklistService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AccessTokenBlacklistService.name);
  private readonly memoryStore = new Map<string, MemoryBlacklistEntry>();
  private redisClient: AppRedisClient | null = null;

  constructor(private readonly configService: ConfigService) {}

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
        `Redis unavailable, fallback to in-memory access-token blacklist: ${(error as Error).message}`,
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

  async blacklist(jti: string, expiresAtEpochSeconds: number): Promise<void> {
    const ttlSeconds = expiresAtEpochSeconds - Math.floor(Date.now() / 1000);
    if (!jti || ttlSeconds <= 0) {
      return;
    }

    this.memoryStore.set(jti, {
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    if (!this.redisClient) {
      return;
    }

    try {
      await this.redisClient.set(this.buildKey(jti), '1', {
        EX: ttlSeconds,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write access-token blacklist for ${jti}: ${(error as Error).message}`,
      );
    }
  }

  async has(jti: string): Promise<boolean> {
    if (!jti) {
      return false;
    }

    const memoryHit = this.memoryStore.get(jti);
    if (memoryHit) {
      if (memoryHit.expiresAt > Date.now()) {
        return true;
      }
      this.memoryStore.delete(jti);
    }

    if (!this.redisClient) {
      return false;
    }

    try {
      const value = await this.redisClient.get(this.buildKey(jti));
      return value !== null;
    } catch (error) {
      this.logger.warn(
        `Failed to read access-token blacklist for ${jti}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private buildKey(jti: string): string {
    return `auth:access-blacklist:${jti}`;
  }
}
