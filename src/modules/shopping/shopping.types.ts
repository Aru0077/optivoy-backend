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
  openingHours: string | null;
  suggestedDurationMinutes: number;
  avgSpendMinCny: number | null;
  avgSpendMaxCny: number | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
