import { ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FacebookOAuthEnabledGuard } from './facebook-oauth-enabled.guard';
import { GoogleOAuthEnabledGuard } from './google-oauth-enabled.guard';

describe('OAuthEnabledGuards', () => {
  const context = {} as ExecutionContext;

  it('Google guard should allow when enabled', () => {
    const configService = {
      get: () => ({ google: { enabled: true } }),
    } as unknown as ConfigService;

    const guard = new GoogleOAuthEnabledGuard(configService);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('Google guard should reject when disabled', () => {
    const configService = {
      get: () => ({ google: { enabled: false } }),
    } as unknown as ConfigService;

    const guard = new GoogleOAuthEnabledGuard(configService);

    try {
      guard.canActivate(context);
      fail('Expected guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('Facebook guard should allow when enabled', () => {
    const configService = {
      get: () => ({ facebook: { enabled: true } }),
    } as unknown as ConfigService;

    const guard = new FacebookOAuthEnabledGuard(configService);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('Facebook guard should reject when disabled', () => {
    const configService = {
      get: () => ({ facebook: { enabled: false } }),
    } as unknown as ConfigService;

    const guard = new FacebookOAuthEnabledGuard(configService);

    try {
      guard.canActivate(context);
      fail('Expected guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
    }
  });
});
