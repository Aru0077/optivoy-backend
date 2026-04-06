import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OptimizerConfig } from '../../config/optimizer.config';
import type {
  OpeningHoursRule,
  QueueProfile,
} from '../../common/utils/planning-metadata.util';

export type OptimizerPointType = 'spot' | 'shopping';

export interface OptimizerPointInput {
  id: string;
  pointType: OptimizerPointType;
  suggestedDurationMinutes: number;
  staminaFactor?: number;
  latitude: number | null;
  longitude: number | null;
  arrivalAnchor?: OptimizerCoordinateInput;
  departureAnchor?: OptimizerCoordinateInput;
  openingHoursJson?: OpeningHoursRule[];
  specialClosureDates?: string[];
  lastEntryTime?: string | null;
  hasFoodCourt?: boolean;
  queueProfileJson?: QueueProfile | null;
}

export interface OptimizerHotelInput {
  id: string;
  latitude: number | null;
  longitude: number | null;
  arrivalAnchor?: OptimizerCoordinateInput;
  departureAnchor?: OptimizerCoordinateInput;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}

export interface OptimizerCoordinateInput {
  latitude: number | null;
  longitude: number | null;
}

export interface OptimizerDistanceMatrixRow {
  fromPointId: string;
  toPointId: string;
  transitMinutes: number;
  drivingMinutes: number;
  walkingMeters: number;
  walkingMinutes?: number | null;
  distanceKm: number;
  transitSummary?: string | null;
}

export interface OptimizerSolveRequest {
  city: string;
  province: string | null;
  startDate: string;
  paceMode: 'light' | 'standard' | 'compact';
  hotelStrategy: 'single' | 'smart';
  mealPolicy: 'auto' | 'off';
  points: OptimizerPointInput[];
  hotels: OptimizerHotelInput[];
  distanceMatrix: {
    rows: OptimizerDistanceMatrixRow[];
  };
  transportPreference?: 'transit_first' | 'driving_first' | 'mixed';
  maxIntradayDrivingMinutes?: number;
}

export interface OptimizerDayResult {
  dayNumber: number;
  date: string;
  pointIds: string[];
  hotelId: string;
}

export interface OptimizerSolveResponse {
  tripDays: number;
  solverStatus: 'OPTIMAL' | 'FEASIBLE';
  objective: string;
  days: OptimizerDayResult[];
  diagnostics?: Record<string, unknown>;
}

export class OptimizerRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly bodyText: string,
    public readonly responseBody?: unknown,
  ) {
    super(`Optimizer request failed: HTTP ${status} ${bodyText.slice(0, 200)}`);
  }
}

@Injectable()
export class OptimizerClient {
  private readonly config: OptimizerConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<OptimizerConfig>(
      'optimizer',
    ) as OptimizerConfig;
  }

  getDefaultTimeLimitSeconds(): number {
    return this.config.defaultTimeLimitSeconds;
  }

  async solve(input: OptimizerSolveRequest): Promise<OptimizerSolveResponse> {
    const endpoint = new URL(
      this.config.solvePath,
      this.config.baseUrl.endsWith('/')
        ? this.config.baseUrl
        : `${this.config.baseUrl}/`,
    );

    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      this.config.requestTimeoutMs,
    );

    try {
      const response = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: abortController.signal,
      });

      const text = await response.text();
      if (!response.ok) {
        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(text);
        } catch {
          parsedBody = undefined;
        }
        throw new OptimizerRequestError(response.status, text, parsedBody);
      }

      return JSON.parse(text) as OptimizerSolveResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}
