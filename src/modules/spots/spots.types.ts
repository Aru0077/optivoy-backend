import { SpotPlaceType } from './entities/spot.entity';

export interface SpotPlaceTypeI18n {
  'zh-CN': string;
  'en-US': string;
  'mn-MN': string;
}

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
  coverImageUrl: string | null;
  introI18n: Record<string, string | undefined>;
  guideI18n: Record<string, string | undefined> | null;
  suggestedDurationMinutes: number;
  reservationRequired: boolean;
  reservationUrl: string | null;
  reservationNoteI18n: Record<string, string | undefined> | null;
  closedWeekdays: number[] | null;
  ticketPriceMinCny: number | string | null;
  ticketPriceMaxCny: number | string | null;
  placeType: SpotPlaceType;
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
  coverImageUrl: string | null;
  intro: string;
  introI18n: Record<string, string | undefined>;
  guide: string;
  guideI18n: Record<string, string | undefined>;
  suggestedDurationMinutes: number;
  reservationRequired: boolean;
  reservationUrl: string | null;
  reservationNote: string;
  reservationNoteI18n: Record<string, string | undefined>;
  closedWeekdays: number[];
  ticketPriceMinCny: number | null;
  ticketPriceMaxCny: number | null;
  placeType: SpotPlaceType;
  placeTypeI18n: SpotPlaceTypeI18n;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CityGroupItem {
  province: string;
  city: string;
  spotCount: number;
}
