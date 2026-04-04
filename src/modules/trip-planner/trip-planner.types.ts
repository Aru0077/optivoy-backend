import { ContentLang } from '../../common/utils/content-i18n.util';
import type {
  BookingStatus,
  MealTimeWindow,
  OpeningHoursRule,
  QueueProfile,
} from '../../common/utils/planning-metadata.util';

export interface TripCityItem {
  province: string;
  city: string;
  spotsCount: number;
  shoppingCount: number;
  restaurantsCount: number;
}

export interface PlannerPointView {
  id: string;
  pointType: 'spot' | 'shopping' | 'restaurant';
  name: string;
  nameI18n: Record<string, string>;
  province: string;
  provinceI18n: Record<string, string>;
  city: string;
  cityI18n: Record<string, string>;
  intro: string;
  introI18n: Record<string, string | undefined>;
  suggestedDurationMinutes: number;
  mealSlots?: string[];
  openingHoursJson?: OpeningHoursRule[];
  specialClosureDates?: string[];
  lastEntryTime?: string | null;
  reservationRequired?: boolean;
  queueProfileJson?: QueueProfile | null;
  hasFoodCourt?: boolean;
  mealTimeWindowsJson?: MealTimeWindow[];
  arrivalAnchorLatitude?: number | null;
  arrivalAnchorLongitude?: number | null;
  departureAnchorLatitude?: number | null;
  departureAnchorLongitude?: number | null;
  latitude: number | null;
  longitude: number | null;
  coverImageUrl: string | null;
}

export interface PlannerHotelCandidate {
  id: string;
  name: string;
  nameI18n: Record<string, string>;
  province: string;
  city: string;
  starLevel: number | null;
  foreignerFriendly: boolean;
  arrivalAnchorLatitude: number | null;
  arrivalAnchorLongitude: number | null;
  departureAnchorLatitude: number | null;
  departureAnchorLongitude: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  bookingUrl: string | null;
  bookingStatus: BookingStatus | null;
  pricePerNightMinCny: number | null;
  pricePerNightMaxCny: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface GeneratedTripLeg {
  fromPointId: string;
  toPointId: string;
  transportMode: 'transit' | 'driving' | 'walking';
  transitMinutes: number;
  drivingMinutes: number;
  walkingMeters: number;
  distanceKm: number;
  transitSummary: string | null;
}

export interface GeneratedTripPoint {
  id: string;
  pointType: 'spot' | 'shopping' | 'restaurant';
  name: string;
  suggestedDurationMinutes: number;
  guideI18n: Record<string, string | undefined>;
  mealSlots?: string[];
  coverImageUrl?: string | null;
}

export interface GeneratedTripDay {
  dayNumber: number;
  date: string;
  hotel: {
    id: string;
    name: string;
    bookingUrl: string;
  };
  legs: GeneratedTripLeg[];
  points: GeneratedTripPoint[];
}

export interface GeneratedTripResult {
  city: string;
  province: string;
  arrivalDateTime: string;
  arrivalBufferMinutes: number;
  tripDays: number;
  solverStatus: 'OPTIMAL' | 'FEASIBLE';
  days: GeneratedTripDay[];
  links: {
    outboundFlight: string;
    returnFlight: string;
  };
  optimizerDiagnostics?: Record<string, unknown>;
}

export interface TripPlannerMatrixCoverageStats {
  expected: number;
  ready: number;
  missing: number;
  coverage: number;
}

export interface TripPlannerMatrixMissingEdge {
  fromPointId: string;
  toPointId: string;
}

export interface TripPlannerMatrixCheckResult {
  city: string;
  province: string;
  nodeCount: number;
  pointCount: number;
  hotelCount: number;
  airportCount: number;
  directed: TripPlannerMatrixCoverageStats;
  undirected: TripPlannerMatrixCoverageStats;
  missingEdgesSample: TripPlannerMatrixMissingEdge[];
  canGenerate: boolean;
}

export type PlannerLang = ContentLang;
