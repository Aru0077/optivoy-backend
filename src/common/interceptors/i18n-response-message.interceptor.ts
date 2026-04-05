import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { I18nContext } from 'nestjs-i18n';
import { SystemMessageI18nService } from '../i18n/system-message-i18n.service';

@Injectable()
export class I18nResponseMessageInterceptor implements NestInterceptor {
  constructor(
    private readonly systemMessageI18nService: SystemMessageI18nService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const lang = I18nContext.current()?.lang;

    return next.handle().pipe(map((data) => this.translatePayload(data, lang)));
  }

  private translatePayload(value: unknown, lang?: string): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.translatePayload(item, lang));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const record = value as Record<string, unknown>;
    const translated: Record<string, unknown> = {};
    const code = typeof record.code === 'string' ? record.code : undefined;

    for (const [key, current] of Object.entries(record)) {
      if (
        (key === 'message' || key === 'lastError') &&
        typeof current === 'string'
      ) {
        translated[key] = this.systemMessageI18nService.translateSystemMessage({
          code: key === 'message' ? code : undefined,
          message: current,
          lang,
        });
        continue;
      }

      if (key === 'details') {
        translated[key] = this.systemMessageI18nService.translateDetails(
          current,
          lang,
        );
        continue;
      }

      translated[key] = this.translatePayload(current, lang);
    }

    return translated;
  }
}
