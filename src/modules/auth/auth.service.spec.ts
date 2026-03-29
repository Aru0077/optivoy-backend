import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { AdminService } from '../admin/admin.service';
import type { AuditService } from '../audit/audit.service';
import { Provider, UserStatus } from '../users/entities/user.entity';
import { UserSecurityTokenType } from '../users/entities/user-security-token.entity';
import type { UsersService } from '../users/users.service';
import type { AccessTokenBlacklistService } from './access-token-blacklist.service';
import type { AdminTwoFactorService } from './admin-two-factor.service';
import { AuthService } from './auth.service';
import type { EmailService } from './email.service';
import type { RateLimitService } from './rate-limit/rate-limit.service';
import type { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  function createService() {
    const usersService = {
      findByAccount: jest.fn(),
      findByEmail: jest.fn(),
      validateLocalPassword: jest.fn(),
      setRefreshToken: jest.fn(),
      findUserByProvider: jest.fn(),
      createOAuthUser: jest.fn(),
      createLocalUser: jest.fn(),
      linkOAuthIdentity: jest.fn(),
      findById: jest.fn(),
      invalidateTokensByType: jest.fn(),
      createSecurityToken: jest.fn(),
      findActiveSecurityTokenByHash: jest.fn(),
      findLatestActiveSecurityTokenForUser: jest.fn(),
      markEmailVerified: jest.fn(),
      markSecurityTokenUsed: jest.fn(),
      markSecurityTokenUsedIfUnused: jest.fn().mockResolvedValue(true),
      updatePassword: jest.fn(),
    };

    const adminService = {
      validatePassword: jest.fn(),
      setRefreshToken: jest.fn(),
      findById: jest.fn(),
    };

    const auditService = {
      create: jest.fn(),
    };

    const rateLimitService = {
      consumeLoginAttempt: jest.fn().mockResolvedValue({
        allowed: true,
        retryAfterSeconds: 0,
        remaining: 3,
      }),
      consumeKey: jest.fn().mockResolvedValue({
        allowed: true,
        retryAfterSeconds: 0,
        remaining: 2,
      }),
      resetKey: jest.fn(),
      resetLoginAttempt: jest.fn(),
    };

    const jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verify: jest.fn(),
    };

    const emailService = {
      sendEmailVerification: jest.fn(),
      sendPasswordReset: jest.fn(),
      sendAdminTwoFactorCode: jest.fn(),
    };

    const accessTokenBlacklistService = {
      blacklist: jest.fn(),
      has: jest.fn().mockResolvedValue(false),
    };

    const adminTwoFactorService = {
      issueChallenge: jest.fn(),
      verifyChallenge: jest.fn(),
    };

    const configService = {
      get: (key: string) => {
        if (key === 'auth') {
          return {
            jwt: {
              accessSecret: 'access-secret',
              accessExpiresIn: '15m',
              refreshSecret: 'refresh-secret',
              refreshExpiresIn: '7d',
            },
            token: {
              emailVerificationTtlMinutes: 60,
              passwordResetTtlMinutes: 30,
            },
            loginRateLimit: {
              windowSeconds: 900,
              maxAttempts: 5,
            },
            oauthInitialPassword: 'Optivoy@2026',
          };
        }
        if (key === 'app') {
          return { nodeEnv: 'test' };
        }
        return undefined;
      },
    } as unknown as ConfigService;

    const service = new AuthService(
      usersService as unknown as UsersService,
      adminService as unknown as AdminService,
      auditService as unknown as AuditService,
      rateLimitService as unknown as RateLimitService,
      emailService as unknown as EmailService,
      accessTokenBlacklistService as unknown as AccessTokenBlacklistService,
      adminTwoFactorService as unknown as AdminTwoFactorService,
      jwtService as unknown as JwtService,
      configService,
    );

    return {
      service,
      usersService,
      rateLimitService,
      jwtService,
      accessTokenBlacklistService,
    };
  }

  it('should reject suspended user local login', async () => {
    const { service, usersService } = createService();

    usersService.validateLocalPassword.mockResolvedValue({
      id: 'user-1',
      account: 'user@example.com',
      name: 'User',
      avatar: null,
      passwordHash: 'hash',
      status: UserStatus.Suspended,
      statusReason: 'manual block',
      email: null,
      emailVerifiedAt: null,
      hashedRefreshToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await expect(
      service.loginUser('user@example.com', 'password123', '127.0.0.1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should return generic response when requesting password reset for unknown email', async () => {
    const { service, usersService } = createService();
    usersService.findByEmail.mockResolvedValue(null);

    const result = await service.requestPasswordReset('none@example.com');
    expect(result.message).toContain('password reset email has been sent');
  });

  it('should reject oauth login for banned user', async () => {
    const { service, usersService } = createService();

    usersService.findUserByProvider.mockResolvedValue({
      id: 'user-1',
      account: 'user@example.com',
      name: 'User',
      avatar: null,
      passwordHash: null,
      status: UserStatus.Banned,
      statusReason: 'abuse',
      email: 'user@example.com',
      emailVerifiedAt: new Date(),
      hashedRefreshToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await expect(
      service.authenticateOAuth(Provider.Google, {
        providerId: 'g-1',
        email: 'user@example.com',
        name: 'User',
        avatar: undefined,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should allow password login with oauth default password for legacy oauth user', async () => {
    const { service, usersService } = createService();

    usersService.validateLocalPassword.mockResolvedValue(null);
    usersService.findByAccount.mockResolvedValue({
      id: 'user-1',
      account: 'oauth-user@example.com',
      name: 'OAuth User',
      avatar: null,
      passwordHash: null,
      status: UserStatus.Active,
      statusReason: null,
      email: 'oauth-user@example.com',
      emailVerifiedAt: new Date(),
      hashedRefreshToken: null,
      hashedAppRefreshToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await service.loginUser(
      'oauth-user@example.com',
      'Optivoy@2026',
      '127.0.0.1',
    );

    expect(usersService.updatePassword).toHaveBeenCalledTimes(1);
    const updatePasswordCalls = usersService.updatePassword.mock.calls as Array<
      [string, string]
    >;
    const hash = updatePasswordCalls[0]?.[1] ?? '';
    await expect(bcrypt.compare('Optivoy@2026', hash)).resolves.toBe(true);
  });

  it('should assign default password hash when creating first oauth user', async () => {
    const { service, usersService } = createService();

    usersService.findUserByProvider.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(null);
    usersService.findByAccount.mockResolvedValue(null);
    usersService.createOAuthUser.mockImplementation(
      (input: {
        account: string;
        email: string;
        name: string;
        avatar?: string | null;
        passwordHash?: string | null;
      }) => ({
        id: 'user-1',
        account: input.account,
        name: input.name,
        avatar: input.avatar ?? null,
        passwordHash: input.passwordHash ?? null,
        status: UserStatus.Active,
        statusReason: null,
        email: input.email,
        emailVerifiedAt: new Date(),
        hashedRefreshToken: null,
        hashedAppRefreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await service.authenticateOAuth(Provider.Google, {
      providerId: 'g-1',
      email: 'new-user@example.com',
      name: 'New User',
      avatar: undefined,
    });

    expect(usersService.createOAuthUser).toHaveBeenCalledTimes(1);
    const createOAuthUserCalls = usersService.createOAuthUser.mock
      .calls as Array<
      [
        {
          account: string;
          email: string;
          name: string;
          avatar?: string | null;
          passwordHash?: string | null;
        },
      ]
    >;
    const payload = createOAuthUserCalls[0]?.[0];
    expect(payload?.account).toBe('new-user@example.com');
    expect(payload?.email).toBe('new-user@example.com');
    expect(typeof payload?.passwordHash).toBe('string');
    await expect(
      bcrypt.compare('Optivoy@2026', payload?.passwordHash ?? ''),
    ).resolves.toBe(true);
  });

  it('should backfill default password for oauth identity user without password', async () => {
    const { service, usersService } = createService();

    usersService.findUserByProvider.mockResolvedValue({
      id: 'user-1',
      account: 'user@example.com',
      name: 'User',
      avatar: null,
      passwordHash: null,
      status: UserStatus.Active,
      statusReason: null,
      email: 'user@example.com',
      emailVerifiedAt: new Date(),
      hashedRefreshToken: null,
      hashedAppRefreshToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await service.authenticateOAuth(Provider.Google, {
      providerId: 'g-1',
      email: 'user@example.com',
      name: 'User',
      avatar: undefined,
    });

    expect(usersService.updatePassword).toHaveBeenCalledTimes(1);
    const updatePasswordCalls = usersService.updatePassword.mock.calls as Array<
      [string, string]
    >;
    const hash = updatePasswordCalls[0]?.[1] ?? '';
    await expect(bcrypt.compare('Optivoy@2026', hash)).resolves.toBe(true);
  });

  it('should backfill default password before requiring account link', async () => {
    const { service, usersService } = createService();

    usersService.findUserByProvider.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      account: 'user@example.com',
      name: 'User',
      avatar: null,
      passwordHash: null,
      status: UserStatus.Active,
      statusReason: null,
      email: 'user@example.com',
      emailVerifiedAt: new Date(),
      hashedRefreshToken: null,
      hashedAppRefreshToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await expect(
      service.authenticateOAuth(Provider.Facebook, {
        providerId: 'f-1',
        email: 'user@example.com',
        name: 'User',
        avatar: undefined,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(usersService.updatePassword).toHaveBeenCalledTimes(1);
    const updatePasswordCalls = usersService.updatePassword.mock.calls as Array<
      [string, string]
    >;
    const hash = updatePasswordCalls[0]?.[1] ?? '';
    await expect(bcrypt.compare('Optivoy@2026', hash)).resolves.toBe(true);
  });

  it('should reject password reset confirm when token already consumed', async () => {
    const { service, usersService } = createService();

    usersService.findActiveSecurityTokenByHash.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      type: 'password_reset',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      targetEmail: null,
      createdAt: new Date(),
      user: {
        id: 'user-1',
        account: 'user@example.com',
        name: 'User',
        avatar: null,
        passwordHash: 'hash',
        status: UserStatus.Active,
        statusReason: null,
        email: null,
        emailVerifiedAt: new Date(),
        hashedRefreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never);
    usersService.markSecurityTokenUsedIfUnused.mockResolvedValue(false);

    await expect(
      service.confirmPasswordReset('valid-token-value', 'NewPassword123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should rotate refresh token for active user', async () => {
    const { service, usersService, jwtService } = createService();
    const currentRefreshToken = 'current-refresh-token';
    const hashedRefreshToken = await bcrypt.hash(currentRefreshToken, 10);

    usersService.findById.mockResolvedValue({
      id: 'user-1',
      account: 'user@example.com',
      name: 'User',
      avatar: null,
      passwordHash: 'hash',
      status: UserStatus.Active,
      statusReason: null,
      email: 'user@example.com',
      emailVerifiedAt: new Date(),
      hashedRefreshToken,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    jwtService.sign
      .mockReturnValueOnce('next-access-token')
      .mockReturnValueOnce('next-refresh-token');

    const tokens = await service.refreshTokens(
      'user-1',
      'user',
      currentRefreshToken,
      'user-web',
    );

    expect(tokens).toEqual({
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
    });
    expect(usersService.setRefreshToken).toHaveBeenCalledWith(
      'user-1',
      'next-refresh-token',
      'web',
    );
  });

  it('should reject refresh token reuse after rotation', async () => {
    const { service, usersService } = createService();
    const validRefreshToken = 'valid-refresh-token';
    const rotatedRefreshToken = 'rotated-refresh-token';

    usersService.findById.mockResolvedValue({
      id: 'user-1',
      account: 'user@example.com',
      name: 'User',
      avatar: null,
      passwordHash: 'hash',
      status: UserStatus.Active,
      statusReason: null,
      email: 'user@example.com',
      emailVerifiedAt: new Date(),
      hashedRefreshToken: await bcrypt.hash(rotatedRefreshToken, 10),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await expect(
      service.refreshTokens('user-1', 'user', validRefreshToken, 'user-web'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should invalidate email verification token after three failed attempts', async () => {
    const { service, usersService, rateLimitService } = createService();

    usersService.findLatestActiveSecurityTokenForUser.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      type: UserSecurityTokenType.EmailVerification,
      tokenHash: 'expected-hash',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      usedAt: null,
      targetEmail: 'user@example.com',
      createdAt: new Date(),
    } as never);
    rateLimitService.consumeKey.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 0,
    });

    await expect(
      service.confirmEmailVerification('user-1', 'user', '000000'),
    ).rejects.toThrow('Verification code has expired');

    expect(rateLimitService.consumeKey).toHaveBeenCalled();
    expect(usersService.markSecurityTokenUsedIfUnused).toHaveBeenCalledWith(
      'token-1',
    );
    expect(rateLimitService.resetKey).toHaveBeenCalledWith(
      'auth:email-verification:attempts:token-1',
    );
  });

  it('should blacklist access token jti on logout', async () => {
    const { service, usersService, accessTokenBlacklistService } =
      createService();

    await service.logout(
      'user-1',
      'user',
      'user-web',
      'access-jti',
      Math.floor(Date.now() / 1000) + 900,
    );

    expect(usersService.setRefreshToken).toHaveBeenCalledWith(
      'user-1',
      null,
      'web',
    );
    expect(accessTokenBlacklistService.blacklist).toHaveBeenCalledWith(
      'access-jti',
      expect.any(Number),
    );
  });
});
