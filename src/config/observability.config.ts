import { registerAs } from '@nestjs/config';

export interface ObservabilityConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint: string;
  otlpHeaders: string;
  exporterTimeoutMs: number;
  traceSampleRatio: number;
}

export const observabilityConfig = registerAs(
  'observability',
  (): ObservabilityConfig => ({
    enabled: (process.env.OTEL_ENABLED ?? 'false').toLowerCase() === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'optivoy-backend',
    serviceVersion: process.env.OTEL_SERVICE_VERSION ?? '0.0.1',
    otlpEndpoint:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://127.0.0.1:4318',
    otlpHeaders: process.env.OTEL_EXPORTER_OTLP_HEADERS ?? '',
    exporterTimeoutMs: parseInt(
      process.env.OTEL_EXPORTER_OTLP_TIMEOUT_MS ?? '10000',
      10,
    ),
    traceSampleRatio: parseFloat(process.env.OTEL_TRACE_SAMPLE_RATIO ?? '0.2'),
  }),
);
