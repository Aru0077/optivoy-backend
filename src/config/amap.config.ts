import { registerAs } from '@nestjs/config';

export interface AmapConfig {
  enabled: boolean;
  webApiKey: string;
  nearbyDefaultRadius: number;
  nearbyMaxLimit: number;
  requestTimeoutMs: number;
  distanceMatrixMaxOrigins: number;
}

export const amapConfig = registerAs(
  'amap',
  (): AmapConfig => ({
    enabled: (process.env.AMAP_ENABLED ?? 'false').toLowerCase() === 'true',
    webApiKey: process.env.AMAP_WEB_API_KEY ?? '',
    nearbyDefaultRadius: parseInt(
      process.env.AMAP_NEARBY_DEFAULT_RADIUS ?? '5000',
      10,
    ),
    nearbyMaxLimit: parseInt(process.env.AMAP_NEARBY_MAX_LIMIT ?? '20', 10),
    requestTimeoutMs: parseInt(process.env.AMAP_REQUEST_TIMEOUT_MS ?? '8000', 10),
    distanceMatrixMaxOrigins: parseInt(
      process.env.AMAP_DISTANCE_MATRIX_MAX_ORIGINS ?? '25',
      10,
    ),
  }),
);
