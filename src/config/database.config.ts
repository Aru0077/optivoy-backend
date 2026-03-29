import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export type DatabaseConfig = TypeOrmModuleOptions;

export const databaseConfig = registerAs(
  'database',
  (): DatabaseConfig => ({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'optivoy',
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    migrations: [join(__dirname, '..', 'migrations', '*{.ts,.js}')],
    extra: {
      max: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
      min: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: parseInt(
        process.env.DB_CONNECTION_TIMEOUT_MS ?? '5000',
        10,
      ),
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT_MS ?? '10000', 10),
      statement_timeout: parseInt(
        process.env.DB_QUERY_TIMEOUT_MS ?? '10000',
        10,
      ),
    },
  }),
);
