import type { BookingStatus } from '../../common/utils/planning-metadata.util';

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
  intro: string;
  introI18n: Record<string, string | undefined>;
  guide: string;
  guideI18n: Record<string, string | undefined>;
  notice: string;
  noticeI18n: Record<string, string | undefined>;
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
  bookableDatesJson: string[];
  pricePerNightMinCny: number | null;
  pricePerNightMaxCny: number | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
