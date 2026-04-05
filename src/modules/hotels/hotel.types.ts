export interface HotelView {
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
  starLevel: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  bookingUrl: string | null;
  pricePerNightMinCny: number | null;
  pricePerNightMaxCny: number | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
