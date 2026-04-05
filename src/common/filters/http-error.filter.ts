import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { Request, Response } from 'express';
import { SystemMessageI18nService } from '../i18n/system-message-i18n.service';

const DEFAULT_ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

@Injectable()
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  constructor(
    private readonly systemMessageI18nService: SystemMessageI18nService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const lang = this.resolveLang(host);
    const payload = this.normalizePayload(exception, status, lang);

    if (!(exception instanceof HttpException)) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${request.url} failed with ${status}`,
        stack,
      );
    }

    response.status(status).json({
      ...payload,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizePayload(
    exception: unknown,
    status: number,
    lang?: string,
  ): { code: string; message: string; details?: unknown } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        const code = DEFAULT_ERROR_CODES[status] ?? 'HTTP_ERROR';
        return {
          code,
          message: this.systemMessageI18nService.translateSystemMessage({
            message: response,
            lang,
          }),
        };
      }

      if (typeof response === 'object' && response) {
        const body = response as Record<string, unknown>;
        const explicitCode =
          typeof body.code === 'string' ? body.code : undefined;
        const code =
          explicitCode ?? DEFAULT_ERROR_CODES[status] ?? 'HTTP_ERROR';

        const message =
          typeof body.message === 'string'
            ? this.systemMessageI18nService.translateSystemMessage({
                code: explicitCode,
                message: body.message,
                lang,
              })
            : Array.isArray(body.message)
              ? this.systemMessageI18nService.translateSystemMessage({
                  code: 'VALIDATION_FAILED',
                  message: 'Request payload validation failed',
                  lang,
                })
              : this.systemMessageI18nService.translateSystemMessage({
                  code,
                  message: exception.message,
                  lang,
                });

        const details = this.systemMessageI18nService.translateDetails(
          body.details ??
            (Array.isArray(body.message) ? body.message : undefined),
          lang,
        );

        return details ? { code, message, details } : { code, message };
      }
    }

    return {
      code: DEFAULT_ERROR_CODES[status] ?? 'INTERNAL_SERVER_ERROR',
      message: this.systemMessageI18nService.translateSystemMessage({
        code: DEFAULT_ERROR_CODES[status] ?? 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        lang,
      }),
    };
  }

  private resolveLang(host: ArgumentsHost): string | undefined {
    if (typeof host.getType === 'function') {
      return I18nContext.current(host)?.lang;
    }
    return I18nContext.current()?.lang;
  }
}
