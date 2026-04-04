import type { OpeningHoursRule } from '../../common/utils/planning-metadata.util';

export interface ShoppingView {
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
  openingHoursJson: OpeningHoursRule[];
  specialClosureDates: string[];
  arrivalAnchorLatitude: number | null;
  arrivalAnchorLongitude: number | null;
  departureAnchorLatitude: number | null;
  departureAnchorLongitude: number | null;
  suggestedDurationMinutes: number;
  hasFoodCourt: boolean;
  avgSpendMinCny: number | null;
  avgSpendMaxCny: number | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
