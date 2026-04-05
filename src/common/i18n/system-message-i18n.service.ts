import { Injectable } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import {
  RAW_MESSAGE_KEY_MAP,
  VALIDATION_KEY_MAP,
  ValidationIssueDetail,
} from './system-message.constants';

@Injectable()
export class SystemMessageI18nService {
  constructor(private readonly i18n: I18nService) {}

  getCurrentLang(): string | undefined {
    return I18nContext.current()?.lang;
  }

  translateSystemMessage(input: {
    code?: string | null;
    message?: string | null;
    lang?: string;
    args?: Record<string, unknown>;
  }): string {
    const message = input.message?.trim() ?? '';
    const key = this.resolveKey(input.code ?? undefined, message || undefined);
    if (!key) {
      return message;
    }
    return this.i18n.translate(`system.${key}`, {
      lang: input.lang,
      args: input.args,
      defaultValue: message || key,
    });
  }

  translateDetails(details: unknown, lang?: string): unknown {
    if (!Array.isArray(details)) {
      return details;
    }

    return details.map((item) => {
      if (typeof item === 'string') {
        return this.translateSystemMessage({ message: item, lang });
      }
      if (this.isValidationIssueDetail(item)) {
        return this.translateValidationIssue(item, lang);
      }
      return item;
    });
  }

  private resolveKey(code?: string, message?: string): string | null {
    if (code) {
      return code;
    }
    if (message && RAW_MESSAGE_KEY_MAP[message]) {
      return RAW_MESSAGE_KEY_MAP[message];
    }
    return null;
  }

  private isValidationIssueDetail(
    value: unknown,
  ): value is ValidationIssueDetail {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const detail = value as Record<string, unknown>;
    return (
      typeof detail.field === 'string' &&
      typeof detail.constraint === 'string' &&
      typeof detail.message === 'string'
    );
  }

  private translateValidationIssue(
    detail: ValidationIssueDetail,
    lang?: string,
  ): string {
    const key = VALIDATION_KEY_MAP[detail.constraint] ?? 'INVALID';
    const limit = this.extractFirstNumber(detail.message);

    return this.i18n.translate(`validation.${key}`, {
      lang,
      args: {
        field: detail.field,
        limit,
      },
      defaultValue: detail.message,
    });
  }

  private extractFirstNumber(message: string): number | undefined {
    const match = message.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return undefined;
    }
    const value = Number(match[0]);
    return Number.isFinite(value) ? value : undefined;
  }
}
