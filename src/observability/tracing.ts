import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';

let tracingSdk: NodeSDK | null = null;
let initialized = false;
let shutdownHookRegistered = false;

export function initializeTracing(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  if ((process.env.OTEL_ENABLED ?? 'false').toLowerCase() !== 'true') {
    return;
  }

  const traceSampleRatio = clampSampleRatio(
    parseFloat(process.env.OTEL_TRACE_SAMPLE_RATIO ?? '0.2'),
  );
  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'optivoy-backend';
  const serviceVersion = process.env.OTEL_SERVICE_VERSION ?? '0.0.1';
  const otlpEndpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://127.0.0.1:4318';
  const otlpHeaders = parseHeaders(
    process.env.OTEL_EXPORTER_OTLP_HEADERS ?? '',
  );
  const exporterTimeoutMs = parseInt(
    process.env.OTEL_EXPORTER_OTLP_TIMEOUT_MS ?? '10000',
    10,
  );

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  tracingSdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': serviceName,
      'service.version': serviceVersion,
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(traceSampleRatio),
    }),
    traceExporter: new OTLPTraceExporter({
      url: normalizeTraceEndpoint(otlpEndpoint),
      headers: otlpHeaders,
      timeoutMillis: exporterTimeoutMs,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  tracingSdk.start();
  registerShutdownHook();
}

async function shutdownTracing(): Promise<void> {
  if (!tracingSdk) {
    return;
  }

  const sdk = tracingSdk;
  tracingSdk = null;
  await sdk.shutdown().catch((error: unknown) => {
    console.error('[OTEL] Failed to shutdown tracing SDK:', error);
  });
}

function registerShutdownHook(): void {
  if (shutdownHookRegistered) {
    return;
  }
  shutdownHookRegistered = true;

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void shutdownTracing();
    });
  }
}

function normalizeTraceEndpoint(endpoint: string): string {
  const normalized = endpoint.replace(/\/+$/, '');
  return normalized.endsWith('/v1/traces')
    ? normalized
    : `${normalized}/v1/traces`;
}

function parseHeaders(raw: string): Record<string, string> {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((headers, item) => {
      const separatorIndex = item.indexOf('=');
      if (separatorIndex <= 0) {
        return headers;
      }
      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      if (key && value) {
        headers[key] = value;
      }
      return headers;
    }, {});
}

function clampSampleRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.2;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
