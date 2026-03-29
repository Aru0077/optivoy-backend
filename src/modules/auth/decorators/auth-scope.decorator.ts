import { SetMetadata } from '@nestjs/common';
import { AuthClient } from '../auth.service';

export interface AuthScopeOptions {
  role: 'user' | 'admin';
  client: AuthClient;
}

export const AUTH_SCOPE_KEY = 'auth_scope';

export const AuthScope = (options: AuthScopeOptions) =>
  SetMetadata(AUTH_SCOPE_KEY, options);
