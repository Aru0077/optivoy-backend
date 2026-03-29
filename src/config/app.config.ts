import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  corsOrigin: string;
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'],
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  }),
);
