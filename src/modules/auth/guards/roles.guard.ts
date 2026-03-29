import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatusCacheService } from '../../users/user-status-cache.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userStatusCacheService: UserStatusCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<
      Array<'admin' | 'user'>
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!user) {
      return false;
    }
    if (!requiredRoles.includes(user.role)) {
      return false;
    }

    if (user.role === 'user') {
      await this.userStatusCacheService.assertActive(user.sub);
    }

    return true;
  }
}
