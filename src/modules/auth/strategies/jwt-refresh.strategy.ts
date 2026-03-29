import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthConfig } from '../../../config/auth.config';
import { JwtPayload } from './jwt.strategy';

export interface JwtRefreshPayload extends JwtPayload {
  refreshToken: string;
}

function resolveCookieName(req: Request, auth: AuthConfig): string {
  const path = req.path || req.url || '';
  if (path.includes('/auth/admin/refresh')) {
    return auth.refreshCookie.admin.name;
  }
  return auth.refreshCookie.user.name;
}

function readCookieValue(req: Request, cookieName: string): string {
  const parsedCookies = req.cookies as Record<string, string> | undefined;
  const cookieFromMiddleware = parsedCookies?.[cookieName];
  if (cookieFromMiddleware) {
    return cookieFromMiddleware;
  }

  const rawCookie = req.headers.cookie;
  if (!rawCookie) {
    return '';
  }

  for (const part of rawCookie.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name === cookieName) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return '';
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    const auth = configService.get<AuthConfig>('auth')!;
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const cookieName = resolveCookieName(req, auth);
          return readCookieValue(req, cookieName) || null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: auth.jwt.refreshSecret,
      passReqToCallback: true,
    });
    this.auth = auth;
  }

  private readonly auth: AuthConfig;

  validate(req: Request, payload: JwtPayload): JwtRefreshPayload {
    const authHeader = req.headers.authorization ?? '';
    const refreshTokenFromHeader = authHeader.replace('Bearer ', '').trim();
    const refreshToken =
      refreshTokenFromHeader ||
      readCookieValue(req, resolveCookieName(req, this.auth));
    return { ...payload, refreshToken };
  }
}
