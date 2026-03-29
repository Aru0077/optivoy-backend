import { ConfigService } from '@nestjs/config';
import { AccessTokenBlacklistService } from './access-token-blacklist.service';

describe('AccessTokenBlacklistService', () => {
  const configService = {
    get: (key: string) => {
      if (key === 'redis') {
        return { enabled: false };
      }
      if (key === 'app') {
        return { nodeEnv: 'test' };
      }
      return undefined;
    },
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-18T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should blacklist jti until token ttl expires', async () => {
    const service = new AccessTokenBlacklistService(configService);
    const expiresAt = Math.floor(Date.now() / 1000) + 60;

    await service.blacklist('access-jti-1', expiresAt);

    expect(await service.has('access-jti-1')).toBe(true);

    jest.advanceTimersByTime(61_000);

    expect(await service.has('access-jti-1')).toBe(false);
  });

  it('should ignore already expired tokens when blacklisting', async () => {
    const service = new AccessTokenBlacklistService(configService);
    const expiredAt = Math.floor(Date.now() / 1000) - 1;

    await service.blacklist('expired-jti', expiredAt);

    expect(await service.has('expired-jti')).toBe(false);
  });
});
