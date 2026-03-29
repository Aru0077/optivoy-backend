import { SpotLang } from './dto/list-spots-query.dto';
import { SpotPlaceType } from './entities/spot.entity';
import { SpotPlaceTypeI18n } from './spots.types';

export const SPOT_PLACE_TYPES: SpotPlaceType[] = [
  'attraction',
  'theme_park',
  'culture',
  'other',
];

export function normalizePlaceType(value: unknown): SpotPlaceType {
  if (
    typeof value === 'string' &&
    SPOT_PLACE_TYPES.includes(value as SpotPlaceType)
  ) {
    return value as SpotPlaceType;
  }
  return 'attraction';
}

export function getPlaceTypeI18n(placeType: SpotPlaceType): SpotPlaceTypeI18n {
  if (placeType === 'theme_park') {
    return {
      'zh-CN': '主题乐园',
      'en-US': 'Theme Park',
      'mn-MN': 'Сэдэвчилсэн парк',
    };
  }
  if (placeType === 'culture') {
    return {
      'zh-CN': '文化场馆',
      'en-US': 'Culture Venue',
      'mn-MN': 'Соёлын газар',
    };
  }
  if (placeType === 'other') {
    return {
      'zh-CN': '其他',
      'en-US': 'Other',
      'mn-MN': 'Бусад',
    };
  }
  return {
    'zh-CN': '景点',
    'en-US': 'Attraction',
    'mn-MN': 'Үзмэр',
  };
}

export function toNullableNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveIntro(
  introI18n: Record<string, string | undefined>,
  lang: SpotLang,
): string {
  if (lang === 'zh-CN') {
    return introI18n['zh-CN'] ?? introI18n['en-US'] ?? introI18n['mn-MN'] ?? '';
  }
  if (lang === 'en-US') {
    return introI18n['en-US'] ?? introI18n['mn-MN'] ?? introI18n['zh-CN'] ?? '';
  }
  return introI18n['mn-MN'] ?? introI18n['en-US'] ?? introI18n['zh-CN'] ?? '';
}

export function resolveGuide(
  guideI18n: Record<string, string | undefined>,
  lang: SpotLang,
): string {
  if (lang === 'zh-CN') {
    return guideI18n['zh-CN'] ?? guideI18n['en-US'] ?? guideI18n['mn-MN'] ?? '';
  }
  if (lang === 'en-US') {
    return guideI18n['en-US'] ?? guideI18n['mn-MN'] ?? guideI18n['zh-CN'] ?? '';
  }
  return guideI18n['mn-MN'] ?? guideI18n['en-US'] ?? guideI18n['zh-CN'] ?? '';
}

export function resolveReservationNote(
  reservationNoteI18n: Record<string, string | undefined>,
  lang: SpotLang,
): string {
  if (lang === 'zh-CN') {
    return (
      reservationNoteI18n['zh-CN'] ??
      reservationNoteI18n['en-US'] ??
      reservationNoteI18n['mn-MN'] ??
      ''
    );
  }
  if (lang === 'en-US') {
    return (
      reservationNoteI18n['en-US'] ??
      reservationNoteI18n['mn-MN'] ??
      reservationNoteI18n['zh-CN'] ??
      ''
    );
  }
  return (
    reservationNoteI18n['mn-MN'] ??
    reservationNoteI18n['en-US'] ??
    reservationNoteI18n['zh-CN'] ??
    ''
  );
}

export function resolveName(
  nameI18n: Record<string, string>,
  lang: SpotLang,
): string {
  if (lang === 'zh-CN') {
    return nameI18n['zh-CN'] ?? nameI18n['en-US'] ?? nameI18n['mn-MN'] ?? '';
  }
  if (lang === 'en-US') {
    return nameI18n['en-US'] ?? nameI18n['mn-MN'] ?? nameI18n['zh-CN'] ?? '';
  }
  return nameI18n['mn-MN'] ?? nameI18n['en-US'] ?? nameI18n['zh-CN'] ?? '';
}

export function toCyrillicApprox(rawLatin: string): string {
  const source = rawLatin.trim();
  if (!source) return '';
  const overrides: Record<string, string> = {
    Beijing: 'Бээжин',
    Tianjin: 'Тяньжинь',
    Shanghai: 'Шанхай',
    Chongqing: 'Чунчин',
    'Inner Mongolia': 'Өвөр Монгол',
    'Hong Kong': 'Хонконг',
    Macao: 'Макао',
  };
  if (overrides[source]) return overrides[source];
  return source
    .replace(/sh/gi, 'ш')
    .replace(/ch/gi, 'ч')
    .replace(/zh/gi, 'ж')
    .replace(/kh/gi, 'х')
    .replace(/ts/gi, 'ц')
    .replace(/ya/gi, 'я')
    .replace(/yo/gi, 'ё')
    .replace(/yu/gi, 'ю')
    .replace(/a/gi, 'а')
    .replace(/b/gi, 'б')
    .replace(/c/gi, 'к')
    .replace(/d/gi, 'д')
    .replace(/e/gi, 'э')
    .replace(/f/gi, 'ф')
    .replace(/g/gi, 'г')
    .replace(/h/gi, 'х')
    .replace(/i/gi, 'и')
    .replace(/j/gi, 'ж')
    .replace(/k/gi, 'к')
    .replace(/l/gi, 'л')
    .replace(/m/gi, 'м')
    .replace(/n/gi, 'н')
    .replace(/o/gi, 'о')
    .replace(/p/gi, 'п')
    .replace(/q/gi, 'к')
    .replace(/r/gi, 'р')
    .replace(/s/gi, 'с')
    .replace(/t/gi, 'т')
    .replace(/u/gi, 'у')
    .replace(/v/gi, 'в')
    .replace(/w/gi, 'в')
    .replace(/x/gi, 'кс')
    .replace(/y/gi, 'й')
    .replace(/z/gi, 'з');
}

export function normalizeStringArray(values?: string[]): string[] {
  if (!values?.length) {
    return [];
  }
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
}

export function normalizeWeekdays(
  values: number[] | null | undefined,
): number[] {
  if (!values?.length) {
    return [];
  }
  const normalized = values.filter(
    (value) => Number.isInteger(value) && value >= 0 && value <= 6,
  );
  return Array.from(new Set(normalized)).sort((a, b) => a - b);
}
