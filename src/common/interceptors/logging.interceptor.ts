import {
  HttpException,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl, ip } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        this.logger.log({
          method,
          url: originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - start,
          ip,
        });
      }),
      catchError((error: unknown) => {
        const res = context.switchToHttp().getResponse<Response>();
        const status =
          error instanceof HttpException
            ? error.getStatus()
            : res.statusCode || 500;

        const httpResponse =
          error instanceof HttpException ? error.getResponse() : null;

        const normalizedError =
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { message: 'Unknown error' };

        const details =
          typeof httpResponse === 'object' &&
          httpResponse !== null &&
          'details' in httpResponse
            ? (httpResponse as { details?: unknown }).details
            : undefined;

        const code =
          typeof httpResponse === 'object' &&
          httpResponse !== null &&
          'code' in httpResponse &&
          typeof (httpResponse as { code?: unknown }).code === 'string'
            ? (httpResponse as { code: string }).code
            : undefined;

        this.logger.error({
          method,
          url: originalUrl,
          status,
          durationMs: Date.now() - start,
          ip,
          error: details
            ? { ...normalizedError, code, details }
            : code
              ? { ...normalizedError, code }
              : normalizedError,
        });

        return throwError(() => error);
      }),
    );
  }
}
