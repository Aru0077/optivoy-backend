import {
  AppRedisClient,
  createAppRedisClient,
  RedisConnectionOptions,
} from '../../../common/redis/redis-client.factory';
import { RateLimitStore } from './rate-limit.store';

export class RedisRateLimitStore implements RateLimitStore {
  private readonly client: AppRedisClient;

  constructor(private readonly options: RedisConnectionOptions) {
    this.client = createAppRedisClient(this.options);
  }

  async connect(): Promise<void> {
    if (this.client.isOpen) {
      return;
    }
    await this.client.connect();
  }

  async close(): Promise<void> {
    if (!this.client.isOpen) {
      return;
    }
    await this.client.quit();
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const script =
      'local c=redis.call("INCR",KEYS[1]) ' +
      'if c==1 then redis.call("EXPIRE",KEYS[1],ARGV[1]) end ' +
      'return c';
    const result = await this.client.eval(script, {
      keys: [key],
      arguments: [String(ttlSeconds)],
    });
    if (typeof result === 'number') {
      return result;
    }
    if (typeof result === 'string') {
      return parseInt(result, 10) || 0;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
