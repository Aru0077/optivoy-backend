import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    void context;
    return {
      scope: ['email', 'profile'],
      session: false,
    };
  }
}
