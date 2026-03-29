import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthConfig } from '../../../config/auth.config';

@Injectable()
export class FacebookOAuthEnabledGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    void context;
    const auth = this.configService.get<AuthConfig>('auth')!;
    if (auth.facebook.enabled) {
      return true;
    }

    throw new ServiceUnavailableException({
      code: 'OAUTH_PROVIDER_DISABLED',
      message: 'Facebook OAuth is disabled on this server.',
    });
  }
}
