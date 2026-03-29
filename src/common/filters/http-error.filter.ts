import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = this.normalizePayload(exception, status);

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
  ): { code: string; message: string; details?: unknown } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          code: DEFAULT_ERROR_CODES[status] ?? 'HTTP_ERROR',
          message: response,
        };
      }

      if (typeof response === 'object' && response) {
        const body = response as Record<string, unknown>;
        const code =
          typeof body.code === 'string'
            ? body.code
            : (DEFAULT_ERROR_CODES[status] ?? 'HTTP_ERROR');

        const message =
          typeof body.message === 'string'
            ? body.message
            : Array.isArray(body.message)
              ? 'Validation failed'
              : exception.message;

        const details =
          body.details ??
          (Array.isArray(body.message) ? body.message : undefined);

        return details ? { code, message, details } : { code, message };
      }
    }

    return {
      code: DEFAULT_ERROR_CODES[status] ?? 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    };
  }
}
