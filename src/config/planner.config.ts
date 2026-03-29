import { registerAs } from '@nestjs/config';

export interface PlannerConfig {
  aiEnabled: boolean;
  aiPrimaryProvider: 'deepseek' | 'qwen';
  aiTimeoutMs: number;
  aiMaxRetries: number;
  deepseekApiBaseUrl: string;
  deepseekApiKey: string;
  deepseekModel: string;
  qwenApiBaseUrl: string;
  qwenApiKey: string;
  qwenModel: string;
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
    aiEnabled:
      (process.env.ITINERARY_AI_ENABLED ?? 'false').toLowerCase() === 'true',
    aiPrimaryProvider:
      (process.env.ITINERARY_AI_PRIMARY_PROVIDER ?? 'deepseek') === 'qwen'
        ? 'qwen'
        : 'deepseek',
    aiTimeoutMs: parseInt(process.env.ITINERARY_AI_TIMEOUT_MS ?? '30000', 10),
    aiMaxRetries: parseInt(process.env.ITINERARY_AI_MAX_RETRIES ?? '1', 10),
    deepseekApiBaseUrl:
      process.env.ITINERARY_AI_DEEPSEEK_API_BASE_URL ??
      process.env.ITINERARY_AI_API_BASE_URL ??
      'https://api.deepseek.com/v1',
    deepseekApiKey:
      process.env.ITINERARY_AI_DEEPSEEK_API_KEY ??
      process.env.ITINERARY_AI_API_KEY ??
      '',
    deepseekModel:
      process.env.ITINERARY_AI_DEEPSEEK_MODEL ??
      process.env.ITINERARY_AI_MODEL ??
      'deepseek-chat',
    qwenApiBaseUrl:
      process.env.ITINERARY_AI_QWEN_API_BASE_URL ??
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    qwenApiKey: process.env.ITINERARY_AI_QWEN_API_KEY ?? '',
    qwenModel: process.env.ITINERARY_AI_QWEN_MODEL ?? 'qwen-plus',
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
