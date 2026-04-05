import { BadRequestException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common/interfaces';
import { HttpErrorFilter } from './http-error.filter';
import { SystemMessageI18nService } from '../i18n/system-message-i18n.service';

describe('HttpErrorFilter', () => {
  it('should keep custom error code and message', () => {
    const filter = new HttpErrorFilter({
      translateSystemMessage: ({ message }: { message?: string | null }) =>
        message ?? '',
      translateDetails: (details: unknown) => details,
    } as SystemMessageI18nService);
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();

    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json }),
        getRequest: () => ({ url: '/auth/user/register' }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request payload validation failed',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        message: 'Request payload validation failed',
        statusCode: 400,
        path: '/auth/user/register',
      }),
    );
  });
});
