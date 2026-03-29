import { createClient, RedisClientOptions } from 'redis';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export function buildRedisClientOptions(
  options: RedisConnectionOptions,
): RedisClientOptions {
  return {
    socket: {
      host: options.host,
      port: options.port,
      reconnectStrategy: false,
      connectTimeout: 1000,
    },
    password: options.password || undefined,
    database: options.db ?? 0,
  };
}

export type AppRedisClient = ReturnType<typeof createClient>;

export function createAppRedisClient(
  options: RedisConnectionOptions,
): AppRedisClient {
  return createClient(buildRedisClientOptions(options));
}
