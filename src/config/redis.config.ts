import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  enabled: boolean;
  host: string;
  port: number;
  password: string;
  db: number;
}

export const redisConfig = registerAs(
  'redis',
  (): RedisConfig => ({
    enabled: process.env.REDIS_ENABLED !== 'false',
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? '',
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
  }),
);
