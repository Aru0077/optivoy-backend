import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTH_SCOPE_KEY,
  AuthScopeOptions,
} from '../decorators/auth-scope.decorator';
import { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class AuthScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const scope = this.reflector.getAllAndOverride<
      AuthScopeOptions | undefined
    >(AUTH_SCOPE_KEY, [context.getHandler(), context.getClass()]);

    if (!scope) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    if (user.role !== scope.role) {
      throw new UnauthorizedException('Token role mismatch');
    }
    if (user.client && user.client !== scope.client) {
      throw new UnauthorizedException('Token client mismatch');
    }

    return true;
  }
}
