import { registerAs } from '@nestjs/config';

export interface OptimizerConfig {
  baseUrl: string;
  solvePath: string;
  requestTimeoutMs: number;
  defaultTimeLimitSeconds: number;
}

export const optimizerConfig = registerAs('optimizer', (): OptimizerConfig => {
  const baseUrl = process.env.OPTIMIZER_BASE_URL?.trim();
  const solvePath = process.env.OPTIMIZER_SOLVE_PATH?.trim();

  return {
    baseUrl: baseUrl && baseUrl.length > 0 ? baseUrl : 'http://127.0.0.1:8088',
    solvePath: solvePath && solvePath.length > 0 ? solvePath : '/solve',
    requestTimeoutMs: parseInt(
      process.env.OPTIMIZER_REQUEST_TIMEOUT_MS ?? '30000',
      10,
    ),
    defaultTimeLimitSeconds: parseFloat(
      process.env.OPTIMIZER_DEFAULT_TIME_LIMIT_SECONDS ?? '8',
    ),
  };
});
