import { ContentLang } from '../../common/utils/content-i18n.util';
import type {
  OpeningHoursRule,
  PlanningDayType,
  QueueProfile,
} from '../../common/utils/planning-metadata.util';

export interface TripCityItem {
  province: string;
  city: string;
  spotsCount: number;
  shoppingCount: number;
}

export interface PlannerPointView {
  id: string;
  pointType: 'spot' | 'shopping';
  name: string;
  nameI18n: Record<string, string>;
  province: string;
  provinceI18n: Record<string, string>;
  city: string;
  cityI18n: Record<string, string>;
  intro: string;
  introI18n: Record<string, string | undefined>;
  suggestedDurationMinutes: number;
  openingHoursJson?: OpeningHoursRule[];
  specialClosureDates?: string[];
  lastEntryTime?: string | null;
  reservationRequired?: boolean;
  queueProfileJson?: QueueProfile | null;
  hasFoodCourt?: boolean;
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
  checkInTime: string | null;
  checkOutTime: string | null;
  bookingUrl: string | null;
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
  pointType: 'spot' | 'shopping';
  name: string;
  suggestedDurationMinutes: number;
  guideI18n: Record<string, string | undefined>;
  coverImageUrl?: string | null;
  hasFoodCourt?: boolean;
  lunchIncluded?: boolean;
  lunchNote?: string | null;
}

export interface GeneratedTripHotelStop {
  id: string;
  name: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface GeneratedTripTransportSequenceItem extends GeneratedTripLeg {
  itemType: 'transport';
}

export interface GeneratedTripPointSequenceItem extends GeneratedTripPoint {
  itemType: 'point';
}

export interface GeneratedTripLunchBreakSequenceItem {
  itemType: 'lunch_break';
  durationMinutes: number;
  note: string;
}

export interface GeneratedTripHotelSequenceItem {
  itemType: 'hotel';
  phase: 'start' | 'transfer' | 'end';
  hotel: GeneratedTripHotelStop;
}

export type GeneratedTripSequenceItem =
  | GeneratedTripHotelSequenceItem
  | GeneratedTripTransportSequenceItem
  | GeneratedTripPointSequenceItem
  | GeneratedTripLunchBreakSequenceItem;

export interface GeneratedTripDay {
  dayNumber: number;
  date: string;
  dayType?: 'visit' | 'blank';
  blankReason?: string | null;
  planningDayType?: PlanningDayType;
  hotel: GeneratedTripHotelStop;
  sequence: GeneratedTripSequenceItem[];
}

export interface GeneratedTripResult {
  city: string;
  province: string;
  startDate: string;
  endDate: string;
  tripDays: number;
  solverStatus: 'OPTIMAL' | 'FEASIBLE';
  days: GeneratedTripDay[];
  hotelBookingLinks: HotelBookingLink[];
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
  directed: TripPlannerMatrixCoverageStats;
  undirected: TripPlannerMatrixCoverageStats;
  missingEdgesSample: TripPlannerMatrixMissingEdge[];
  canGenerate: boolean;
}

export interface HotelBookingLink {
  hotelId: string;
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  bookingUrl: string;
}

export type PlannerLang = ContentLang;
