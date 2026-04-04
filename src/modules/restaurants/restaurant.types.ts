import type {
  MealTimeWindow,
  QueueProfile,
} from '../../common/utils/planning-metadata.util';
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
  arrivalAnchorLatitude: number | null;
  arrivalAnchorLongitude: number | null;
  departureAnchorLatitude: number | null;
  departureAnchorLongitude: number | null;
  suggestedDurationMinutes: number;
  mealSlots: RestaurantMealSlot[];
  mealTimeWindowsJson: MealTimeWindow[];
  cuisineTags: string[];
  reservationRequired: boolean;
  reservationUrl: string | null;
  queueProfileJson: QueueProfile | null;
  avgSpendMinCny: number | null;
  avgSpendMaxCny: number | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
