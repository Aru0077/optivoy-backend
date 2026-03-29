import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { ConfirmEmailVerificationDto } from '../src/modules/auth/dto/confirm-email-verification.dto';
import { UserLoginDto } from '../src/modules/auth/dto/user-login.dto';
import { UserRegisterDto } from '../src/modules/auth/dto/user-register.dto';
import { FacebookOAuthEnabledGuard } from '../src/modules/auth/guards/facebook-oauth-enabled.guard';
import { GoogleOAuthEnabledGuard } from '../src/modules/auth/guards/google-oauth-enabled.guard';

describe('Auth module integration (no-port e2e)', () => {
  let authController: AuthController;
  let googleGuard: GoogleOAuthEnabledGuard;
  let facebookGuard: FacebookOAuthEnabledGuard;
  const responseMock = () =>
    ({
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }) as Partial<Response> & {
      cookie: jest.Mock;
      clearCookie: jest.Mock;
      redirect: jest.Mock;
      status: jest.Mock;
      json: jest.Mock;
    };

  const authServiceMock: Record<string, jest.Mock> = {
    loginAdmin: jest.fn(),
    verifyAdminTwoFactor: jest.fn(),
    registerUser: jest.fn(),
    loginUser: jest.fn(),
    requestEmailVerification: jest.fn(),
    confirmEmailVerification: jest.fn(),
    requestPasswordReset: jest.fn(),
    confirmPasswordReset: jest.fn(),
    authenticateOAuth: jest.fn(),
    linkOAuthIdentity: jest.fn(),
    refreshTokens: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  };

  const createValidationPipe = () =>
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const details = errors.flatMap((error) =>
          Object.values(error.constraints ?? {}),
        );
        return new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Request payload validation failed',
          details,
        });
      },
    });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        GoogleOAuthEnabledGuard,
        FacebookOAuthEnabledGuard,
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'auth') {
                return {
                  refreshCookie: {
                    user: {
                      name: 'optivoy_rt',
                      domain: '',
                      path: '/auth',
                      sameSite: 'lax',
                      secure: false,
                    },
                    admin: {
                      name: 'optivoy_admin_rt',
                      domain: '',
                      path: '/auth/admin',
                      sameSite: 'strict',
                      secure: false,
                    },
                  },
                  google: { enabled: false },
                  facebook: { enabled: false },
                };
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();

    authController = moduleFixture.get(AuthController);
    googleGuard = moduleFixture.get(GoogleOAuthEnabledGuard);
    facebookGuard = moduleFixture.get(FacebookOAuthEnabledGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('user register should set refresh cookie and return access token', async () => {
    authServiceMock.registerUser.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    const res = responseMock();

    await expect(
      authController.userRegister(
        {
          account: 'user@example.com',
          password: 'P@ssword123',
          name: 'User',
        } as UserRegisterDto,
        res as Response,
      ),
    ).resolves.toEqual({
      accessToken: 'access-token',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'optivoy_rt',
      'refresh-token',
      expect.objectContaining({
        httpOnly: true,
        path: '/auth',
        sameSite: 'lax',
      }),
    );
  });

  it('app login should return token pair without setting cookies', async () => {
    authServiceMock.loginUser.mockResolvedValue({
      accessToken: 'app-access-token',
      refreshToken: 'app-refresh-token',
    });

    await expect(
      authController.appLogin(
        { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as never,
        {
          account: 'user@example.com',
          password: 'P@ssword123',
        } as UserLoginDto,
      ),
    ).resolves.toEqual({
      accessToken: 'app-access-token',
      refreshToken: 'app-refresh-token',
    });
    expect(authServiceMock.loginUser).toHaveBeenCalledWith(
      'user@example.com',
      'P@ssword123',
      '127.0.0.1',
      'user-app',
    );
  });

  it('app refresh should return token pair without cookies', async () => {
    authServiceMock.refreshTokens.mockResolvedValue({
      accessToken: 'next-app-access-token',
      refreshToken: 'next-app-refresh-token',
    });

    await expect(
      authController.refreshAppTokens({
        user: {
          sub: 'user-1',
          role: 'user',
          client: 'user-app',
          refreshToken: 'current-app-refresh-token',
        },
      } as never),
    ).resolves.toEqual({
      accessToken: 'next-app-access-token',
      refreshToken: 'next-app-refresh-token',
    });
    expect(authServiceMock.refreshTokens).toHaveBeenCalledWith(
      'user-1',
      'user',
      'current-app-refresh-token',
      'user-app',
    );
  });

  it('app logout should revoke app refresh channel without cookies', async () => {
    authServiceMock.logout.mockResolvedValue(undefined);

    await expect(
      authController.logoutApp({
        user: {
          sub: 'user-1',
          role: 'user',
          client: 'user-app',
          jti: 'access-jti',
          exp: 4_102_444_800,
        },
      } as never),
    ).resolves.toBeUndefined();
    expect(authServiceMock.logout).toHaveBeenCalledWith(
      'user-1',
      'user',
      'user-app',
      'access-jti',
      4_102_444_800,
    );
  });

  it('admin 2fa verify should set admin refresh cookie and return access token', async () => {
    authServiceMock.verifyAdminTwoFactor.mockResolvedValue({
      accessToken: 'admin-access-token',
      refreshToken: 'admin-refresh-token',
    });
    const res = responseMock();

    await expect(
      authController.verifyAdminTwoFactor(
        { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as never,
        {
          challengeToken: 'challenge-token',
          code: '123456',
        } as never,
        res as Response,
      ),
    ).resolves.toEqual({
      accessToken: 'admin-access-token',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'optivoy_admin_rt',
      'admin-refresh-token',
      expect.objectContaining({
        httpOnly: true,
        path: '/auth/admin',
        sameSite: 'strict',
      }),
    );
  });

  it('user register dto should fail validation with normalized payload', async () => {
    const pipe = createValidationPipe();

    try {
      await pipe.transform(
        { email: 'invalid-email', password: '123' },
        {
          type: 'body',
          metatype: UserRegisterDto,
          data: '',
        },
      );
      fail('Expected validation to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        code?: string;
      };
      expect(response.code).toBe('VALIDATION_FAILED');
    }
  });

  it('user login should propagate unauthorized error', async () => {
    authServiceMock.loginUser.mockRejectedValue(
      new UnauthorizedException('Invalid credentials'),
    );
    const res = responseMock();

    await expect(
      authController.userLogin(
        { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as never,
        {
          account: 'user@example.com',
          password: 'bad-password',
        } as UserLoginDto,
        res as Response,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('password reset request should return message response', async () => {
    authServiceMock.requestPasswordReset.mockResolvedValue({
      message: 'If the email exists, a password reset email has been sent.',
    });

    await expect(
      authController.requestPasswordReset({ email: 'user@example.com' }),
    ).resolves.toEqual({
      message: 'If the email exists, a password reset email has been sent.',
    });
  });

  it('email verification confirm dto should fail validation', async () => {
    const pipe = createValidationPipe();

    await expect(
      pipe.transform(
        { token: 'short' },
        {
          type: 'body',
          metatype: ConfirmEmailVerificationDto,
          data: '',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('oauth guards should return 503 when provider disabled', () => {
    expect(() => googleGuard.canActivate({} as never)).toThrow(
      ServiceUnavailableException,
    );
    expect(() => facebookGuard.canActivate({} as never)).toThrow(
      ServiceUnavailableException,
    );
  });
});
