import { registerAs } from '@nestjs/config';

export interface PlannerConfig {
  tripDefaultLocale: string;
  tripDefaultCurrency: string;
  tripFlightDeeplinkBaseUrl: string;
  tripHotelDeeplinkBaseUrl: string;
  tripAffiliateAid: string;
  tripAffiliateSid: string;
  tripAffiliateOuid: string;
}

export const plannerConfig = registerAs(
  'planner',
  (): PlannerConfig => ({
    tripDefaultLocale: process.env.TRIP_DEFAULT_LOCALE ?? 'en-US',
    tripDefaultCurrency: process.env.TRIP_DEFAULT_CURRENCY ?? 'USD',
    tripFlightDeeplinkBaseUrl:
      process.env.TRIP_FLIGHT_DEEPLINK_BASE_URL ??
      'https://www.trip.com/flights/showfarefirst',
    tripHotelDeeplinkBaseUrl:
      process.env.TRIP_HOTEL_DEEPLINK_BASE_URL ??
      'https://www.trip.com/hotels/list',
    tripAffiliateAid: process.env.TRIP_AFFILIATE_AID ?? '',
    tripAffiliateSid: process.env.TRIP_AFFILIATE_SID ?? '',
    tripAffiliateOuid: process.env.TRIP_AFFILIATE_OUID ?? '',
  }),
);
