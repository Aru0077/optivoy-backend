import { ContentLang } from '../../common/utils/content-i18n.util';

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
  checkInTime: string | null;
  checkOutTime: string | null;
  bookingUrl: string | null;
  pricePerNightMinCny: number | null;
  pricePerNightMaxCny: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PlannerInputPoint {
  id: string;
  pointType: 'spot' | 'shopping';
  name: string;
  intro: string;
  suggestedDurationMinutes: number;
  latitude: number | null;
  longitude: number | null;
}

export interface AiPlanItem {
  pointType: 'spot' | 'shopping';
  refId: string;
  startTime: string;
  endTime: string;
  suggestedStayMinutes: number;
  transitMinutesFromPrev: number;
  reason: string;
}

export interface AiPlanDay {
  date: string;
  startType: 'arrival' | 'hotel';
  startRefId: string | null;
  checkoutRequired: boolean;
  nightHotelId: string;
  hotelId: string;
  hotelReason: string;
  items: AiPlanItem[];
}

export interface AiPlanResult {
  itineraryTitle: string;
  summary: string;
  checkInDate: string;
  checkOutDate: string;
  returnDepartureDateTime: string;
  days: AiPlanDay[];
}

export interface GeneratedTripResult {
  city: string;
  province: string;
  arrivalDateTime: string;
  tripDays: number;
  selectedPoints: PlannerPointView[];
  selectedHotels: PlannerHotelCandidate[];
  aiPlan: AiPlanResult;
  links: {
    outboundFlight: string;
    hotelBooking: string;
    returnFlight: string;
  };
}

export type PlannerLang = ContentLang;
