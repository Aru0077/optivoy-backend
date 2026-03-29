import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthConfig } from '../../../config/auth.config';

export interface OAuthProfile {
  providerId: string;
  email?: string;
  name: string;
  avatar: string | undefined;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const auth = configService.get<AuthConfig>('auth')!;
    const callbackURL =
      auth.google.callbackUrl || 'http://localhost:3000/auth/google/callback';
    const authorizationURL =
      auth.google.authorizationUrl ||
      'https://accounts.google.com/o/oauth2/v2/auth';
    const tokenURL =
      auth.google.tokenUrl || 'https://www.googleapis.com/oauth2/v4/token';
    const userProfileURL =
      auth.google.userProfileUrl ||
      'https://www.googleapis.com/oauth2/v3/userinfo';
    super({
      clientID: auth.google.clientId || 'google-disabled-client-id',
      clientSecret: auth.google.clientSecret || 'google-disabled-secret',
      callbackURL,
      authorizationURL,
      tokenURL,
      userProfileURL,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const oauthProfile: OAuthProfile = {
      providerId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
    };
    done(null, oauthProfile);
  }
}
