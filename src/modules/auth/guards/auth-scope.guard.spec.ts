import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_SCOPE_KEY } from '../decorators/auth-scope.decorator';
import { AuthScopeGuard } from './auth-scope.guard';

describe('AuthScopeGuard', () => {
  function createContext(user?: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => 'handler',
      getClass: () => 'class',
    } as unknown as ExecutionContext;
  }

  it('allows access when no auth scope metadata is present', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new AuthScopeGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('rejects when token role does not match scope', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === AUTH_SCOPE_KEY
            ? { role: 'admin', client: 'admin-web' }
            : undefined,
        ),
    } as unknown as Reflector;
    const guard = new AuthScopeGuard(reflector);

    expect(() =>
      guard.canActivate(
        createContext({ sub: 'user-1', role: 'user', client: 'user-web' }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects when token client does not match scope', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === AUTH_SCOPE_KEY
            ? { role: 'user', client: 'user-app' }
            : undefined,
        ),
    } as unknown as Reflector;
    const guard = new AuthScopeGuard(reflector);

    expect(() =>
      guard.canActivate(
        createContext({ sub: 'user-1', role: 'user', client: 'user-web' }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('allows matching role and client', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === AUTH_SCOPE_KEY
            ? { role: 'user', client: 'user-app' }
            : undefined,
        ),
    } as unknown as Reflector;
    const guard = new AuthScopeGuard(reflector);

    expect(
      guard.canActivate(
        createContext({ sub: 'user-1', role: 'user', client: 'user-app' }),
      ),
    ).toBe(true);
  });
});
