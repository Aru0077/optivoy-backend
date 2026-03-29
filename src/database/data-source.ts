import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { Admin } from '../modules/admin/entities/admin.entity';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { HotelPlace } from '../modules/hotels/entities/hotel.entity';
import { LocationAirport } from '../modules/locations/entities/location-airport.entity';
import { LocationCity } from '../modules/locations/entities/location-city.entity';
import { LocationCountryRef } from '../modules/locations/entities/location-country-ref.entity';
import { LocationProvince } from '../modules/locations/entities/location-province.entity';
import { LocationRegionRef } from '../modules/locations/entities/location-region-ref.entity';
import { UserNotification } from '../modules/notifications/entities/user-notification.entity';
import { ShoppingPlace } from '../modules/shopping/entities/shopping.entity';
import { Spot } from '../modules/spots/entities/spot.entity';
import { UserOauthIdentity } from '../modules/users/entities/user-oauth-identity.entity';
import { UserSecurityToken } from '../modules/users/entities/user-security-token.entity';
import { User } from '../modules/users/entities/user.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'optivoy',
  entities: [
    Admin,
    User,
    UserOauthIdentity,
    UserSecurityToken,
    AuditLog,
    LocationCountryRef,
    LocationRegionRef,
    LocationProvince,
    LocationCity,
    LocationAirport,
    UserNotification,
    Spot,
    ShoppingPlace,
    HotelPlace,
  ],
  migrations: [join(__dirname, '..', 'migrations', '*{.ts,.js}')],
  synchronize: false,
});

export default dataSource;
