import { registerAs } from '@nestjs/config';

export interface MailConfig {
  provider: 'log' | 'resend';
  from: string;
  appBaseUrl: string;
  resendApiKey: string;
}

export const mailConfig = registerAs(
  'mail',
  (): MailConfig => ({
    provider: (process.env.MAIL_PROVIDER ?? 'log') as MailConfig['provider'],
    from: process.env.MAIL_FROM ?? 'no-reply@optivoy.top',
    appBaseUrl: process.env.MAIL_APP_BASE_URL ?? 'http://localhost:3000',
    resendApiKey: process.env.RESEND_API_KEY ?? '',
  }),
);
