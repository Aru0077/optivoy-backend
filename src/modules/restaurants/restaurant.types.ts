import { RestaurantMealSlot } from './entities/restaurant.entity';

export interface RestaurantView {
  id: string;
  name: string;
  nameI18n: Record<string, string>;
  country: string;
  province: string;
  provinceI18n: Record<string, string>;
  city: string;
  cityI18n: Record<string, string>;
  latitude: number | null;
  longitude: number | null;
  coverImageUrl: string | null;
  intro: string;
  introI18n: Record<string, string | undefined>;
  guide: string;
  guideI18n: Record<string, string | undefined>;
  notice: string;
  noticeI18n: Record<string, string | undefined>;
  openingHours: string | null;
  closedWeekdays: number[];
  suggestedDurationMinutes: number;
  mealSlots: RestaurantMealSlot[];
  cuisineTags: string[];
  reservationRequired: boolean;
  reservationUrl: string | null;
  avgSpendMinCny: number | null;
  avgSpendMaxCny: number | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
