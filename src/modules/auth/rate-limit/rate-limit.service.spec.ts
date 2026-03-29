import { ConfigService } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  it('should enforce max attempts with memory store', async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'redis') {
          return { enabled: false };
        }
        return undefined;
      },
    } as unknown as ConfigService;

    const service = new RateLimitService(configService);
    await service.onModuleInit();

    const first = await service.consumeLoginAttempt(
      'user',
      'user@example.com',
      '127.0.0.1',
      2,
      60,
    );
    const second = await service.consumeLoginAttempt(
      'user',
      'user@example.com',
      '127.0.0.1',
      2,
      60,
    );
    const third = await service.consumeLoginAttempt(
      'user',
      'user@example.com',
      '127.0.0.1',
      2,
      60,
    );

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);

    await service.resetLoginAttempt('user', 'user@example.com', '127.0.0.1');

    const afterReset = await service.consumeLoginAttempt(
      'user',
      'user@example.com',
      '127.0.0.1',
      2,
      60,
    );
    expect(afterReset.allowed).toBe(true);
  });
});
