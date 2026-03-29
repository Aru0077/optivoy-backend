export interface RateLimitStore {
  increment(key: string, ttlSeconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  del(key: string): Promise<void>;
  close?(): Promise<void>;
}
