import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError, HealthIndicatorResult } from '@nestjs/terminus';
import OSS from 'ali-oss';
import { OssConfig } from '../../config/oss.config';
import { RedisConfig } from '../../config/redis.config';
import { createAppRedisClient } from '../../common/redis/redis-client.factory';

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  async checkRedis(): Promise<HealthIndicatorResult> {
    const redis = this.configService.get<RedisConfig>('redis');
    if (!redis?.enabled) {
      return { redis: { status: 'up', enabled: false } };
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
      return {
        redis: {
          status: 'up',
          host: redis.host,
          port: redis.port,
          db: redis.db,
        },
      };
    } catch (error) {
      throw new HealthCheckError('Redis check failed', {
        redis: {
          status: 'down',
          message:
            error instanceof Error ? error.message : 'Unknown Redis error',
        },
      });
    } finally {
      if (client.isOpen) {
        await client.quit();
      }
    }
  }

  async checkOss(): Promise<HealthIndicatorResult> {
    const oss = this.configService.get<OssConfig>('oss');
    if (!oss?.enabled) {
      return { oss: { status: 'up', enabled: false } };
    }

    const client = new OSS({
      region: oss.region,
      bucket: oss.bucket,
      accessKeyId: oss.accessKeyId,
      accessKeySecret: oss.accessKeySecret,
      secure: true,
      timeout: '10s',
    });

    try {
      await client.getBucketInfo(oss.bucket);
      return {
        oss: {
          status: 'up',
          bucket: oss.bucket,
          region: oss.region,
        },
      };
    } catch (error) {
      throw new HealthCheckError('OSS check failed', {
        oss: {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown OSS error',
        },
      });
    }
  }
}
