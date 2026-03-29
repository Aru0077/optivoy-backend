import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class FacebookAuthGuard extends AuthGuard('facebook') {
  getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    void context;
    return {
      scope: ['email', 'public_profile'],
      session: false,
    };
  }
}
