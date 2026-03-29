import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthConfig } from '../../../config/auth.config';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '../../users/entities/user.entity';
import { AccessTokenBlacklistService } from '../access-token-blacklist.service';

export interface JwtPayload {
  sub: string;
  account: string;
  role: 'admin' | 'user';
  client?: 'user-web' | 'user-app' | 'admin-web';
  jti: string;
  exp?: number;
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly accessTokenBlacklistService: AccessTokenBlacklistService,
  ) {
    const auth = configService.get<AuthConfig>('auth')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: auth.jwt.accessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (await this.accessTokenBlacklistService.has(payload.jti)) {
      throw new UnauthorizedException('Access token has been revoked');
    }

    if (payload.role === 'user') {
      const user = await this.usersService.findById(payload.sub);
      if (!user || user.status !== UserStatus.Active) {
        throw new UnauthorizedException('Account is inactive or not found');
      }
    }
    return payload;
  }
}
