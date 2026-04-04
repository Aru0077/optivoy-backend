import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  CORS_ORIGIN: Joi.string().default('*'),
  HOME_BANNER_BACKGROUND_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow('')
    .optional(),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().integer().min(1).max(65535).default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  DB_POOL_MIN: Joi.number().integer().min(0).max(100).default(2),
  DB_CONNECTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .default(5000),
  DB_QUERY_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(300000)
    .default(10000),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  AUTH_REFRESH_COOKIE_NAME: Joi.string().trim().default('optivoy_rt'),
  AUTH_REFRESH_COOKIE_DOMAIN: Joi.string().allow('').default(''),
  AUTH_REFRESH_COOKIE_PATH: Joi.string().trim().default('/auth'),
  AUTH_REFRESH_COOKIE_SAME_SITE: Joi.string()
    .valid('lax', 'strict', 'none')
    .default('lax'),
  AUTH_REFRESH_COOKIE_SECURE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .optional(),
  AUTH_ADMIN_REFRESH_COOKIE_NAME: Joi.string()
    .trim()
    .default('optivoy_admin_rt'),
  AUTH_ADMIN_REFRESH_COOKIE_DOMAIN: Joi.string().allow('').default(''),
  AUTH_ADMIN_REFRESH_COOKIE_PATH: Joi.string().trim().default('/auth/admin'),
  AUTH_ADMIN_REFRESH_COOKIE_SAME_SITE: Joi.string()
    .valid('lax', 'strict', 'none')
    .default('strict'),
  AUTH_ADMIN_REFRESH_COOKIE_SECURE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .optional(),
  EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: Joi.number()
    .integer()
    .min(5)
    .max(1440)
    .default(60),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: Joi.number()
    .integer()
    .min(5)
    .max(1440)
    .default(30),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(86400)
    .default(900),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(5),

  // Redis
  REDIS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().integer().min(1).max(65535).default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),

  // Mail
  MAIL_PROVIDER: Joi.string().valid('log', 'resend').default('log'),
  MAIL_FROM: Joi.string().email().default('no-reply@optivoy.top'),
  MAIL_APP_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  RESEND_API_KEY: Joi.when('MAIL_PROVIDER', {
    is: 'resend',
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').default(''),
  }),

  // OSS
  OSS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  OSS_REGION: Joi.when('OSS_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  OSS_BUCKET: Joi.when('OSS_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  OSS_ACCESS_KEY_ID: Joi.when('OSS_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  OSS_ACCESS_KEY_SECRET: Joi.when('OSS_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  OSS_PUBLIC_BASE_URL: Joi.string().uri().allow('').optional(),
  OSS_UPLOAD_PREFIX: Joi.string().default('spots'),
  OSS_MAX_FILE_SIZE_MB: Joi.number().integer().min(1).max(50).default(10),
  OSS_MAX_FILES_PER_REQUEST: Joi.number().integer().min(1).max(20).default(10),
  OSS_ALLOWED_IMAGE_FORMATS: Joi.string().default('jpg,jpeg,png,webp'),
  OSS_MIN_IMAGE_WIDTH: Joi.number().integer().min(1).max(20000).default(200),
  OSS_MIN_IMAGE_HEIGHT: Joi.number().integer().min(1).max(20000).default(200),
  OSS_MAX_IMAGE_WIDTH: Joi.number().integer().min(1).max(20000).default(8192),
  OSS_MAX_IMAGE_HEIGHT: Joi.number().integer().min(1).max(20000).default(8192),
  OSS_HOME_BANNER_MIN_IMAGE_WIDTH: Joi.number()
    .integer()
    .min(1)
    .max(40000)
    .default(1),
  OSS_HOME_BANNER_MIN_IMAGE_HEIGHT: Joi.number()
    .integer()
    .min(1)
    .max(40000)
    .default(1),
  OSS_HOME_BANNER_MAX_IMAGE_WIDTH: Joi.number()
    .integer()
    .min(1)
    .max(40000)
    .default(20000),
  OSS_HOME_BANNER_MAX_IMAGE_HEIGHT: Joi.number()
    .integer()
    .min(1)
    .max(40000)
    .default(20000),
  OSS_STS_ROLE_ARN: Joi.when('OSS_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  OSS_STS_TOKEN_EXPIRES_SECONDS: Joi.number()
    .integer()
    .min(900)
    .max(3600)
    .default(900),
  OSS_STS_USER_PREFIX: Joi.string().default('uploads/users'),
  OSS_STS_ADMIN_PREFIX: Joi.string().default('uploads/admin'),
  OSS_MODERATION_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  OSS_MODERATION_ACCESS_KEY_ID: Joi.when('OSS_MODERATION_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  OSS_MODERATION_ACCESS_KEY_SECRET: Joi.when('OSS_MODERATION_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  OSS_MODERATION_ENDPOINT: Joi.when('OSS_MODERATION_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  OSS_MODERATION_REGION_ID: Joi.when('OSS_MODERATION_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  OSS_MODERATION_SERVICE: Joi.string().default('baselineCheck_cb'),
  OSS_MODERATION_FAIL_OPEN: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  OSS_UPLOAD_OBJECT_ACL: Joi.string()
    .valid('public-read', 'private', 'inherit')
    .default('public-read'),

  // Admin seed
  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_PASSWORD: Joi.string().min(8).required(),
  ADMIN_2FA_TTL_MINUTES: Joi.number().integer().min(3).max(30).default(10),
  ADMIN_2FA_SECRET: Joi.string().min(32).required(),

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().allow('').optional(),
  GOOGLE_AUTHORIZATION_URL: Joi.string().uri().allow('').optional(),
  GOOGLE_TOKEN_URL: Joi.string().uri().allow('').optional(),
  GOOGLE_USER_PROFILE_URL: Joi.string().uri().allow('').optional(),

  // Facebook OAuth
  FACEBOOK_APP_ID: Joi.string().allow('').optional(),
  FACEBOOK_APP_SECRET: Joi.string().allow('').optional(),
  FACEBOOK_CALLBACK_URL: Joi.string().uri().allow('').optional(),
  FACEBOOK_GRAPH_API_VERSION: Joi.string().allow('').optional(),
  FACEBOOK_AUTHORIZATION_URL: Joi.string().uri().allow('').optional(),
  FACEBOOK_TOKEN_URL: Joi.string().uri().allow('').optional(),
  FACEBOOK_PROFILE_URL: Joi.string().uri().allow('').optional(),
  OAUTH_INITIAL_PASSWORD: Joi.string().min(8).allow('').optional(),
  WEB_APP_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow('')
    .default(''),

  // Trip deep links
  TRIP_DEFAULT_LOCALE: Joi.string().default('en-US'),
  TRIP_DEFAULT_CURRENCY: Joi.string().default('USD'),
  TRIP_FLIGHT_DEEPLINK_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://www.trip.com/flights/showfarefirst'),
  TRIP_HOTEL_DEEPLINK_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://www.trip.com/hotels/list'),
  TRIP_AFFILIATE_AID: Joi.string().allow('').default(''),
  TRIP_AFFILIATE_SID: Joi.string().allow('').default(''),
  TRIP_AFFILIATE_OUID: Joi.string().allow('').default(''),

  // Amap
  AMAP_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  AMAP_WEB_API_KEY: Joi.when('AMAP_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  AMAP_NEARBY_DEFAULT_RADIUS: Joi.number()
    .integer()
    .min(100)
    .max(50000)
    .default(5000),
  AMAP_NEARBY_MAX_LIMIT: Joi.number().integer().min(1).max(50).default(20),
  AMAP_REQUEST_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(30000)
    .default(8000),
  AMAP_DISTANCE_MATRIX_MAX_ORIGINS: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(25),
  AMAP_TRANSIT_DIRECTION_CONCURRENCY: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .default(1),
  AMAP_TRANSIT_REQUEST_MIN_INTERVAL_MS: Joi.number()
    .integer()
    .min(0)
    .max(5000)
    .default(220),
  AMAP_TRANSIT_QPS_RETRY_COUNT: Joi.number()
    .integer()
    .min(0)
    .max(10)
    .default(3),
  AMAP_TRANSIT_QPS_BACKOFF_MS: Joi.number()
    .integer()
    .min(100)
    .max(10000)
    .default(1500),

  // Optimizer
  OPTIMIZER_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow('')
    .default('http://127.0.0.1:8088'),
  OPTIMIZER_SOLVE_PATH: Joi.string().default('/solve'),
  OPTIMIZER_REQUEST_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .default(10000),
  OPTIMIZER_DEFAULT_TIME_LIMIT_SECONDS: Joi.number()
    .min(0.2)
    .max(30)
    .default(2.5),

  // Observability
  OTEL_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  OTEL_SERVICE_NAME: Joi.string().default('optivoy-backend'),
  OTEL_SERVICE_VERSION: Joi.string().default('0.0.1'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://127.0.0.1:4318'),
  OTEL_EXPORTER_OTLP_HEADERS: Joi.string().allow('').default(''),
  OTEL_EXPORTER_OTLP_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .default(10000),
  OTEL_TRACE_SAMPLE_RATIO: Joi.number().min(0).max(1).default(0.2),
}).custom((value: unknown, helpers) => {
  const env =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};

  const readNonEmpty = (key: string): string | null => {
    const raw = env[key];
    if (typeof raw !== 'string') {
      return null;
    }
    const normalized = raw.trim();
    return normalized ? normalized : null;
  };

  const googleFields = [
    readNonEmpty('GOOGLE_CLIENT_ID'),
    readNonEmpty('GOOGLE_CLIENT_SECRET'),
    readNonEmpty('GOOGLE_CALLBACK_URL'),
  ].filter((item): item is string => item !== null);
  if (googleFields.length > 0 && googleFields.length < 3) {
    return helpers.error('any.invalid', {
      message:
        'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL must be configured together.',
    });
  }

  const facebookFields = [
    readNonEmpty('FACEBOOK_APP_ID'),
    readNonEmpty('FACEBOOK_APP_SECRET'),
    readNonEmpty('FACEBOOK_CALLBACK_URL'),
  ].filter((item): item is string => item !== null);
  if (facebookFields.length > 0 && facebookFields.length < 3) {
    return helpers.error('any.invalid', {
      message:
        'FACEBOOK_APP_ID, FACEBOOK_APP_SECRET and FACEBOOK_CALLBACK_URL must be configured together.',
    });
  }

  const sameSite = readNonEmpty('AUTH_REFRESH_COOKIE_SAME_SITE');
  const secure = env.AUTH_REFRESH_COOKIE_SECURE;
  if (sameSite === 'none' && (secure === 'false' || secure === false)) {
    return helpers.error('any.invalid', {
      message:
        'AUTH_REFRESH_COOKIE_SECURE must be true when AUTH_REFRESH_COOKIE_SAME_SITE is none.',
    });
  }

  const adminSameSite = readNonEmpty('AUTH_ADMIN_REFRESH_COOKIE_SAME_SITE');
  const adminSecure = env.AUTH_ADMIN_REFRESH_COOKIE_SECURE;
  if (
    adminSameSite === 'none' &&
    (adminSecure === 'false' || adminSecure === false)
  ) {
    return helpers.error('any.invalid', {
      message:
        'AUTH_ADMIN_REFRESH_COOKIE_SECURE must be true when AUTH_ADMIN_REFRESH_COOKIE_SAME_SITE is none.',
    });
  }

  return env;
}, 'feature configuration consistency');
