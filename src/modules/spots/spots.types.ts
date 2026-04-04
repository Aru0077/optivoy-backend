import type {
  OpeningHoursRule,
  QueueProfile,
} from '../../common/utils/planning-metadata.util';

export interface SpotRawRow {
  id: string;
  name: string;
  nameI18n: Record<string, string> | null;
  country: string;
  province: string;
  provinceI18n: Record<string, string> | null;
  city: string;
  cityI18n: Record<string, string> | null;
  latitude: number | string | null;
  longitude: number | string | null;
  entryLatitude: number | string | null;
  entryLongitude: number | string | null;
  exitLatitude: number | string | null;
  exitLongitude: number | string | null;
  coverImageUrl: string | null;
  introI18n: Record<string, string | undefined>;
  guideI18n: Record<string, string | undefined> | null;
  noticeI18n: Record<string, string | undefined> | null;
  openingHoursJson?: OpeningHoursRule[] | null;
  specialClosureDates?: string[] | null;
  lastEntryTime?: string | null;
  suggestedDurationMinutes: number;
  reservationRequired: boolean;
  reservationUrl: string | null;
  reservationNoteI18n: Record<string, string | undefined> | null;
  queueProfileJson?: QueueProfile | null;
  hasFoodCourt: boolean;
  ticketPriceMinCny: number | string | null;
  ticketPriceMaxCny: number | string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpotView {
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
  entryLatitude: number | null;
  entryLongitude: number | null;
  exitLatitude: number | null;
  exitLongitude: number | null;
  coverImageUrl: string | null;
  intro: string;
  introI18n: Record<string, string | undefined>;
  guide: string;
  guideI18n: Record<string, string | undefined>;
  notice: string;
  noticeI18n: Record<string, string | undefined>;
  openingHoursJson: OpeningHoursRule[];
  specialClosureDates: string[];
  lastEntryTime: string | null;
  suggestedDurationMinutes: number;
  reservationRequired: boolean;
  reservationUrl: string | null;
  reservationNote: string;
  reservationNoteI18n: Record<string, string | undefined>;
  queueProfileJson: QueueProfile | null;
  hasFoodCourt: boolean;
  ticketPriceMinCny: number | null;
  ticketPriceMaxCny: number | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CityGroupItem {
  province: string;
  city: string;
  spotCount: number;
}
