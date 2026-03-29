import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AdminService } from '../admin/admin.service';
import { Admin } from '../admin/entities/admin.entity';
import { AdminTwoFactorService } from './admin-two-factor.service';
import type { EmailService } from './email.service';
import type { RateLimitService } from './rate-limit/rate-limit.service';

describe('AdminTwoFactorService', () => {
  const admin = {
    id: 'admin-1',
    email: 'admin@example.com',
  } as Admin;

  function createService() {
    const challengeStore = new Map<string, string>();
    const configService = {
      get: (key: string) => {
        if (key === 'auth') {
          return {
            jwt: {
              accessSecret: 'access-secret-access-secret-123456',
            },
            admin: {
              twoFactorTtlMinutes: 10,
              twoFactorSecret: 'admin-2fa-secret-admin-2fa-123456',
            },
          };
        }
        if (key === 'redis') {
          return { enabled: false };
        }
        if (key === 'app') {
          return { nodeEnv: 'test' };
        }
        return undefined;
      },
    } as unknown as ConfigService;

    const jwtService = {
      sign: jest.fn().mockReturnValue('challenge-token'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;
    jwtService.verify.mockImplementation(
      () => (jwtService.sign.mock.calls[0]?.[0] ?? null) as never,
    );

    const adminService = {
      findById: jest.fn().mockResolvedValue(admin),
    };

    const emailService = {
      sendAdminTwoFactorCode: jest.fn().mockResolvedValue(undefined),
    };

    const rateLimitService = {
      consumeKey: jest.fn().mockResolvedValue({
        allowed: true,
        retryAfterSeconds: 0,
        remaining: 4,
      }),
      resetKey: jest.fn().mockResolvedValue(undefined),
    };

    const redisClient = {
      set: jest.fn().mockImplementation((key: string, value: string) => {
        challengeStore.set(key, value);
        return Promise.resolve('OK');
      }),
      get: jest.fn().mockImplementation((key: string) => {
        return Promise.resolve(challengeStore.get(key) ?? null);
      }),
      del: jest.fn().mockImplementation((key: string) => {
        challengeStore.delete(key);
        return Promise.resolve(1);
      }),
      quit: jest.fn().mockResolvedValue('OK'),
    };

    const service = new AdminTwoFactorService(
      configService,
      jwtService,
      adminService as unknown as AdminService,
      emailService as unknown as EmailService,
      rateLimitService as unknown as RateLimitService,
    );
    (
      service as unknown as {
        redisClient: typeof redisClient;
      }
    ).redisClient = redisClient;

    return {
      service,
      jwtService,
      adminService,
      emailService,
      rateLimitService,
      redisClient,
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should issue challenge, hash the code, and consume it on success', async () => {
    const {
      service,
      jwtService,
      emailService,
      rateLimitService,
      adminService,
    } = createService();

    const result = await service.issueChallenge(admin);
    const challengeId = (
      jwtService.sign.mock.calls[0]?.[0] as { cid?: string } | undefined
    )?.cid;
    const sendCodeCalls = emailService.sendAdminTwoFactorCode.mock
      .calls as unknown[][];
    const deliveredCodeRaw: unknown = sendCodeCalls[0]?.[1];
    expect(typeof deliveredCodeRaw).toBe('string');
    const deliveredCode = deliveredCodeRaw as string;
    const stored = await (
      service as unknown as {
        readChallenge: (
          challengeId: string,
        ) => Promise<{ codeHash: string } | null>;
      }
    ).readChallenge(challengeId as string);

    expect(result).toEqual({
      requiresTwoFactor: true,
      challengeToken: 'challenge-token',
      message: 'Verification code sent to admin email address.',
    });
    expect(challengeId).toBeTruthy();
    expect(deliveredCode).toMatch(/^\d{6}$/);
    expect(stored?.codeHash).not.toBe(deliveredCode);

    await expect(
      service.verifyChallenge('challenge-token', deliveredCode),
    ).resolves.toEqual(admin);

    expect(rateLimitService.resetKey).toHaveBeenCalledWith(
      `auth:admin-2fa:attempts:${challengeId as string}`,
    );
    expect(adminService.findById).toHaveBeenCalledWith(admin.id);
    await expect(
      (
        service as unknown as {
          readChallenge: (challengeId: string) => Promise<unknown>;
        }
      ).readChallenge(challengeId as string),
    ).resolves.toBeNull();
  });

  it('should delete challenge after too many failed attempts', async () => {
    const { service, jwtService, rateLimitService } = createService();
    rateLimitService.consumeKey.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 0,
    });

    await service.issueChallenge(admin);
    const challengeId = (
      jwtService.sign.mock.calls[0]?.[0] as { cid?: string } | undefined
    )?.cid;

    await expect(
      service.verifyChallenge('challenge-token', '000000'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(rateLimitService.consumeKey).toHaveBeenCalledWith(
      `auth:admin-2fa:attempts:${challengeId as string}`,
      5,
      expect.any(Number),
    );
    expect(rateLimitService.resetKey).toHaveBeenCalledWith(
      `auth:admin-2fa:attempts:${challengeId as string}`,
    );
    await expect(
      (
        service as unknown as {
          readChallenge: (challengeId: string) => Promise<unknown>;
        }
      ).readChallenge(challengeId as string),
    ).resolves.toBeNull();
  });

  it('should fail closed when Redis-backed challenge storage is unavailable', async () => {
    const { service } = createService();
    (
      service as unknown as {
        redisClient: null;
      }
    ).redisClient = null;

    await expect(service.issueChallenge(admin)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
