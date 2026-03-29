import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  refreshCookie: {
    user: {
      name: string;
      domain: string;
      path: string;
      sameSite: 'lax' | 'strict' | 'none';
      secure: boolean;
    };
    admin: {
      name: string;
      domain: string;
      path: string;
      sameSite: 'lax' | 'strict' | 'none';
      secure: boolean;
    };
  };
  token: {
    emailVerificationTtlMinutes: number;
    passwordResetTtlMinutes: number;
  };
  loginRateLimit: {
    windowSeconds: number;
    maxAttempts: number;
  };
  admin: {
    email: string;
    password: string;
    twoFactorTtlMinutes: number;
    twoFactorSecret: string;
  };
  google: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    authorizationUrl: string;
    tokenUrl: string;
    userProfileUrl: string;
  };
  facebook: {
    enabled: boolean;
    appId: string;
    appSecret: string;
    callbackUrl: string;
    graphApiVersion: string;
    authorizationUrl: string;
    tokenUrl: string;
    profileUrl: string;
  };
  oauthInitialPassword: string;
  webAppBaseUrl: string;
}

export const authConfig = registerAs(
  'auth',
  (): AuthConfig => ({
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET!,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET!,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    refreshCookie: {
      user: {
        name: process.env.AUTH_REFRESH_COOKIE_NAME ?? 'optivoy_rt',
        domain: process.env.AUTH_REFRESH_COOKIE_DOMAIN?.trim() ?? '',
        path: process.env.AUTH_REFRESH_COOKIE_PATH?.trim() || '/auth',
        sameSite:
          (process.env.AUTH_REFRESH_COOKIE_SAME_SITE?.trim().toLowerCase() as
            | 'lax'
            | 'strict'
            | 'none'
            | undefined) ?? 'lax',
        secure:
          process.env.AUTH_REFRESH_COOKIE_SECURE !== undefined
            ? process.env.AUTH_REFRESH_COOKIE_SECURE === 'true'
            : process.env.NODE_ENV === 'production',
      },
      admin: {
        name: process.env.AUTH_ADMIN_REFRESH_COOKIE_NAME ?? 'optivoy_admin_rt',
        domain: process.env.AUTH_ADMIN_REFRESH_COOKIE_DOMAIN?.trim() ?? '',
        path:
          process.env.AUTH_ADMIN_REFRESH_COOKIE_PATH?.trim() || '/auth/admin',
        sameSite:
          (process.env.AUTH_ADMIN_REFRESH_COOKIE_SAME_SITE?.trim().toLowerCase() as
            | 'lax'
            | 'strict'
            | 'none'
            | undefined) ?? 'strict',
        secure:
          process.env.AUTH_ADMIN_REFRESH_COOKIE_SECURE !== undefined
            ? process.env.AUTH_ADMIN_REFRESH_COOKIE_SECURE === 'true'
            : process.env.NODE_ENV === 'production',
      },
    },
    token: {
      emailVerificationTtlMinutes: parseInt(
        process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES ?? '60',
        10,
      ),
      passwordResetTtlMinutes: parseInt(
        process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? '30',
        10,
      ),
    },
    loginRateLimit: {
      windowSeconds: parseInt(
        process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? '900',
        10,
      ),
      maxAttempts: parseInt(
        process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? '5',
        10,
      ),
    },
    admin: {
      email: process.env.ADMIN_EMAIL!,
      password: process.env.ADMIN_PASSWORD!,
      twoFactorTtlMinutes: parseInt(
        process.env.ADMIN_2FA_TTL_MINUTES ?? '10',
        10,
      ),
      twoFactorSecret: process.env.ADMIN_2FA_SECRET!,
    },
    google: {
      enabled: Boolean(
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CALLBACK_URL,
      ),
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? '',
      authorizationUrl: process.env.GOOGLE_AUTHORIZATION_URL ?? '',
      tokenUrl: process.env.GOOGLE_TOKEN_URL ?? '',
      userProfileUrl: process.env.GOOGLE_USER_PROFILE_URL ?? '',
    },
    facebook: {
      enabled: Boolean(
        process.env.FACEBOOK_APP_ID &&
        process.env.FACEBOOK_APP_SECRET &&
        process.env.FACEBOOK_CALLBACK_URL,
      ),
      appId: process.env.FACEBOOK_APP_ID ?? '',
      appSecret: process.env.FACEBOOK_APP_SECRET ?? '',
      callbackUrl: process.env.FACEBOOK_CALLBACK_URL ?? '',
      graphApiVersion: process.env.FACEBOOK_GRAPH_API_VERSION ?? 'v25.0',
      authorizationUrl: process.env.FACEBOOK_AUTHORIZATION_URL ?? '',
      tokenUrl: process.env.FACEBOOK_TOKEN_URL ?? '',
      profileUrl: process.env.FACEBOOK_PROFILE_URL ?? '',
    },
    oauthInitialPassword:
      process.env.OAUTH_INITIAL_PASSWORD?.trim() || 'Optivoy@2026',
    webAppBaseUrl: process.env.WEB_APP_BASE_URL ?? '',
  }),
);
