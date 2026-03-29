import { MemoryRateLimitStore } from './memory-rate-limit.store';

describe('MemoryRateLimitStore', () => {
  it('should cap key count to avoid unbounded growth', async () => {
    const store = new MemoryRateLimitStore();

    for (let i = 0; i < 10_050; i += 1) {
      await store.increment(`rate:key:${i}`, 60);
    }

    const size = (store as unknown as { map: Map<string, unknown> }).map.size;
    expect(size).toBeLessThanOrEqual(10_000);
  });
});
