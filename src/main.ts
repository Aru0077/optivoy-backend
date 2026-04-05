import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpErrorFilter } from './common/filters/http-error.filter';
import { I18nResponseMessageInterceptor } from './common/interceptors/i18n-response-message.interceptor';
import { AppConfig } from './config/app.config';
import { initializeTracing } from './observability/tracing';
import { ValidationIssueDetail } from './common/i18n/system-message.constants';

function flattenValidationIssues(
  errors: ValidationError[],
  parentPath?: string,
): ValidationIssueDetail[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const current = Object.entries(error.constraints ?? {}).map(
      ([constraint, message]) => ({
        field,
        constraint,
        message,
        value: error.value,
      }),
    );
    const nested = flattenValidationIssues(error.children ?? [], field);
    return [...current, ...nested];
  });
}

async function bootstrap(): Promise<void> {
  initializeTracing();
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(app.get(HttpErrorFilter));
  app.useGlobalInterceptors(
    app.get(LoggingInterceptor),
    app.get(I18nResponseMessageInterceptor),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const details = flattenValidationIssues(errors);
        return new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Request payload validation failed',
          details,
        });
      },
    }),
  );

  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app') as AppConfig;
  const port = appConfig.port;

  const corsOrigin = appConfig.corsOrigin;
  const origins =
    corsOrigin === '*'
      ? true
      : corsOrigin
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);
  app.enableCors({ origin: origins, credentials: corsOrigin !== '*' });

  const expressApp = app.getHttpAdapter().getInstance() as {
    disable: (setting: string) => void;
    set: (setting: string, value: unknown) => void;
  };
  expressApp.disable('x-powered-by');
  expressApp.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.use(compression());

  if (appConfig.nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Optivoy API')
      .setDescription('Optivoy travel app REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  app.enableShutdownHooks();
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

void bootstrap();
