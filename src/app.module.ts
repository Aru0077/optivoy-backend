import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nJsonLoader,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { join } from 'path';
import { HttpErrorFilter } from './common/filters/http-error.filter';
import { SystemMessageI18nModule } from './common/i18n/system-message-i18n.module';
import { SystemMessageI18nService } from './common/i18n/system-message-i18n.service';
import { I18nResponseMessageInterceptor } from './common/interceptors/i18n-response-message.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { amapConfig } from './config/amap.config';
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { validationSchema } from './config/config.validation';
import { DatabaseConfig, databaseConfig } from './config/database.config';
import { mailConfig } from './config/mail.config';
import { observabilityConfig } from './config/observability.config';
import { optimizerConfig } from './config/optimizer.config';
import { ossConfig } from './config/oss.config';
import { plannerConfig } from './config/planner.config';
import { redisConfig } from './config/redis.config';
import { AirportCsvImportModule } from './modules/airport-csv-import/airport-csv-import.module';
import { HealthModule } from './modules/health/health.module';
import { HomeModule } from './modules/home/home.module';
import { HotelModule } from './modules/hotels/hotel.module';
import { LocationsModule } from './modules/locations/locations.module';
import { MatrixAdminModule } from './modules/matrix-admin/matrix-admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ShoppingModule } from './modules/shopping/shopping.module';
import { SpotsModule } from './modules/spots/spots.module';
import { TripPlannerModule } from './modules/trip-planner/trip-planner.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        amapConfig,
        optimizerConfig,
        databaseConfig,
        authConfig,
        redisConfig,
        mailConfig,
        ossConfig,
        plannerConfig,
        observabilityConfig,
      ],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'mn-MN',
      fallbacks: {
        mn: 'mn-MN',
        'mn-*': 'mn-MN',
        en: 'en-US',
        'en-*': 'en-US',
        zh: 'zh-CN',
        'zh-*': 'zh-CN',
      },
      loader: I18nJsonLoader,
      loaderOptions: {
        path: join(__dirname, 'i18n'),
        watch: false,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        { use: HeaderResolver, options: ['x-lang'] },
        { use: AcceptLanguageResolver, options: { matchType: 'strict-loose' } },
      ],
    }),
    SystemMessageI18nModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds window
        limit: 120, // max 120 requests per window per IP
      },
    ]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => cs.get<DatabaseConfig>('database')!,
    }),
    AirportCsvImportModule,
    AuditModule,
    AdminModule,
    AuthModule,
    HomeModule,
    MatrixAdminModule,
    LocationsModule,
    NotificationsModule,
    UploadsModule,
    SpotsModule,
    ShoppingModule,
    HotelModule,
    TripPlannerModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    HttpErrorFilter,
    LoggingInterceptor,
    I18nResponseMessageInterceptor,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
