import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OptimizerConfig } from '../../config/optimizer.config';

export type OptimizerPointType = 'spot' | 'shopping' | 'restaurant';

export interface OptimizerPointInput {
  id: string;
  pointType: OptimizerPointType;
  suggestedDurationMinutes: number;
  latitude: number | null;
  longitude: number | null;
}

export interface OptimizerHotelInput {
  id: string;
  latitude: number | null;
  longitude: number | null;
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
  distanceKm: number;
  transitSummary?: string | null;
}

export interface OptimizerSolveRequest {
  city: string;
  province: string | null;
  arrivalAirportCode?: string;
  departureAirportCode?: string;
  arrivalAirportId?: string;
  departureAirportId?: string;
  arrivalAirport?: OptimizerCoordinateInput;
  departureAirport?: OptimizerCoordinateInput;
  arrivalDateTime: string;
  airportBufferMinutes: number;
  paceMode: 'light' | 'standard' | 'compact';
  hotelMode: 'single' | 'multi';
  mealPolicy: 'auto' | 'off';
  points: OptimizerPointInput[];
  hotels: OptimizerHotelInput[];
  distanceMatrix: {
    rows: OptimizerDistanceMatrixRow[];
  };
  objective: 'min_days' | 'min_transit' | 'min_days_then_transit';
  maxDays: number;
  timeLimitSeconds: number;
  switchPenaltyMinutes?: number;
  newHotelPenaltyMinutes?: number;
  maxIterations?: number;
  badDayTransitMinutesThreshold?: number;
  badDayPenaltyMinutes?: number;
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
        throw new Error(
          `Optimizer request failed: HTTP ${response.status} ${text.slice(0, 200)}`,
        );
      }

      return JSON.parse(text) as OptimizerSolveResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}
