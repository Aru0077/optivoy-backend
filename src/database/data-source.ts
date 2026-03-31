import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'optivoy',
  entities: [join(__dirname, '..', 'modules', '**', 'entities', '*{.ts,.js}')],
  migrations: [join(__dirname, '..', 'migrations', '*{.ts,.js}')],
  synchronize: false,
});

export default dataSource;
