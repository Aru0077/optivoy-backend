import { SpotLang } from './dto/list-spots-query.dto';
import { Spot } from './entities/spot.entity';
import { SpotRawRow, SpotView } from './spots.types';
import {
  getPlaceTypeI18n,
  normalizePlaceType,
  normalizeWeekdays,
  resolveGuide,
  resolveIntro,
  resolveName,
  resolveReservationNote,
  toCyrillicApprox,
  toNullableNumber,
} from './spots.shared';

function ensureNameI18n(
  i18n: Record<string, string>,
  fallback: string,
): Record<string, string> {
  const en = i18n['en-US']?.trim() || fallback;
  const mn = i18n['mn-MN']?.trim() || en;
  const zh = i18n['zh-CN']?.trim() || en;
  return {
    'zh-CN': zh,
    'en-US': en,
    'mn-MN': mn,
  };
}

function ensureRegionI18n(
  i18n: Record<string, string>,
  fallbackEn: string,
): Record<string, string> {
  const en = i18n['en-US']?.trim() || fallbackEn;
  const mn = i18n['mn-MN']?.trim() || toCyrillicApprox(en);
  const zh = i18n['zh-CN']?.trim() || en;
  return {
    'zh-CN': zh,
    'en-US': en,
    'mn-MN': mn,
  };
}

function ensureIntroI18n(
  i18n: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const en = i18n['en-US']?.trim() || '';
  const mn = i18n['mn-MN']?.trim() || en;
  const zh = i18n['zh-CN']?.trim() || en;
  return {
    'zh-CN': zh,
    'en-US': en,
    'mn-MN': mn,
  };
}

function ensureGuideI18n(
  i18n: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const en = i18n['en-US']?.trim() || '';
  const mn = i18n['mn-MN']?.trim() || en;
  const zh = i18n['zh-CN']?.trim() || en;
  return {
    'zh-CN': zh,
    'en-US': en,
    'mn-MN': mn,
  };
}

function ensureReservationNoteI18n(
  i18n: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const en = i18n['en-US']?.trim() || '';
  const mn = i18n['mn-MN']?.trim() || en;
  const zh = i18n['zh-CN']?.trim() || en;
  return {
    'zh-CN': zh,
    'en-US': en,
    'mn-MN': mn,
  };
}

export function mapSpot(spot: Spot, lang: SpotLang): SpotView {
  const nameI18n = ensureNameI18n(
    (spot.nameI18n ?? {
      'mn-MN': spot.name,
      'en-US': spot.name,
      'zh-CN': spot.name,
    }) as Record<string, string>,
    spot.name,
  );
  const provinceI18n = ensureRegionI18n(
    (spot.provinceI18n ?? {
      'en-US': spot.province,
      'mn-MN': toCyrillicApprox(spot.province),
      'zh-CN': spot.province,
    }) as Record<string, string>,
    spot.province,
  );
  const cityI18n = ensureRegionI18n(
    (spot.cityI18n ?? {
      'en-US': spot.city,
      'mn-MN': toCyrillicApprox(spot.city),
      'zh-CN': spot.city,
    }) as Record<string, string>,
    spot.city,
  );
  const introI18n = ensureIntroI18n(spot.introI18n ?? {});
  const guideI18n = ensureGuideI18n(spot.guideI18n ?? {});
  const reservationNoteI18n = ensureReservationNoteI18n(
    spot.reservationNoteI18n ?? {},
  );
  const placeType = normalizePlaceType(spot.placeType);

  return {
    id: spot.id,
    name: resolveName(nameI18n, lang),
    nameI18n,
    country: spot.country,
    province: spot.province,
    provinceI18n,
    city: spot.city,
    cityI18n,
    latitude: toNullableNumber(spot.latitude),
    longitude: toNullableNumber(spot.longitude),
    coverImageUrl: spot.coverImageUrl,
    intro: resolveIntro(introI18n, lang),
    introI18n,
    guide: resolveGuide(guideI18n, lang),
    guideI18n,
    suggestedDurationMinutes: spot.suggestedDurationMinutes ?? 240,
    reservationRequired: Boolean(spot.reservationRequired),
    reservationUrl: spot.reservationUrl?.trim() || null,
    reservationNote: resolveReservationNote(reservationNoteI18n, lang),
    reservationNoteI18n,
    closedWeekdays: normalizeWeekdays(spot.closedWeekdays ?? []),
    ticketPriceMinCny: toNullableNumber(spot.ticketPriceMinCny),
    ticketPriceMaxCny: toNullableNumber(spot.ticketPriceMaxCny),
    placeType,
    placeTypeI18n: getPlaceTypeI18n(placeType),
    isPublished: spot.isPublished,
    createdAt: spot.createdAt,
    updatedAt: spot.updatedAt,
  };
}

export function mapRawSpot(row: SpotRawRow, lang: SpotLang): SpotView {
  const nameI18n = ensureNameI18n(
    row.nameI18n ?? {
      'mn-MN': row.name,
      'en-US': row.name,
      'zh-CN': row.name,
    },
    row.name,
  );
  const provinceI18n = ensureRegionI18n(
    row.provinceI18n ?? {
      'en-US': row.province,
      'mn-MN': toCyrillicApprox(row.province),
      'zh-CN': row.province,
    },
    row.province,
  );
  const cityI18n = ensureRegionI18n(
    row.cityI18n ?? {
      'en-US': row.city,
      'mn-MN': toCyrillicApprox(row.city),
      'zh-CN': row.city,
    },
    row.city,
  );
  const introI18n = ensureIntroI18n(row.introI18n ?? {});
  const guideI18n = ensureGuideI18n(row.guideI18n ?? {});
  const reservationNoteI18n = ensureReservationNoteI18n(
    row.reservationNoteI18n ?? {},
  );
  const placeType = normalizePlaceType(row.placeType);

  return {
    id: row.id,
    name: resolveName(nameI18n, lang),
    nameI18n,
    country: row.country,
    province: row.province,
    provinceI18n,
    city: row.city,
    cityI18n,
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
    coverImageUrl: row.coverImageUrl,
    intro: resolveIntro(introI18n, lang),
    introI18n,
    guide: resolveGuide(guideI18n, lang),
    guideI18n,
    suggestedDurationMinutes: Number(row.suggestedDurationMinutes ?? 240),
    reservationRequired: Boolean(row.reservationRequired),
    reservationUrl: row.reservationUrl?.trim() || null,
    reservationNote: resolveReservationNote(reservationNoteI18n, lang),
    reservationNoteI18n,
    closedWeekdays: normalizeWeekdays(row.closedWeekdays ?? []),
    ticketPriceMinCny: toNullableNumber(row.ticketPriceMinCny),
    ticketPriceMaxCny: toNullableNumber(row.ticketPriceMaxCny),
    placeType,
    placeTypeI18n: getPlaceTypeI18n(placeType),
    isPublished: row.isPublished,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
