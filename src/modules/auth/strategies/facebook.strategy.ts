import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
import { AuthConfig } from '../../../config/auth.config';
import { OAuthProfile } from './google.strategy';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(configService: ConfigService) {
    const auth = configService.get<AuthConfig>('auth')!;
    const version = auth.facebook.graphApiVersion || 'v25.0';
    const callbackURL =
      auth.facebook.callbackUrl ||
      'http://localhost:3000/auth/facebook/callback';
    const authorizationURL =
      auth.facebook.authorizationUrl ||
      `https://www.facebook.com/${version}/dialog/oauth`;
    const tokenURL =
      auth.facebook.tokenUrl ||
      `https://graph.facebook.com/${version}/oauth/access_token`;
    const profileURL =
      auth.facebook.profileUrl || `https://graph.facebook.com/${version}/me`;
    super({
      clientID: auth.facebook.appId || 'facebook-disabled-app-id',
      clientSecret: auth.facebook.appSecret || 'facebook-disabled-secret',
      callbackURL,
      authorizationURL,
      tokenURL,
      profileURL,
      graphAPIVersion: version,
      profileFields: ['id', 'displayName', 'photos', 'email'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: unknown, user?: OAuthProfile) => void,
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
