export type ContentLang = 'mn-MN' | 'en-US' | 'zh-CN';
export type LocalizedTextMap = Record<string, string | undefined>;

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
  lang: ContentLang,
): string {
  return resolveLocalizedText(introI18n, lang);
}

export function resolveGuide(
  guideI18n: Record<string, string | undefined>,
  lang: ContentLang,
): string {
  return resolveLocalizedText(guideI18n, lang);
}

export function resolveNotice(
  noticeI18n: Record<string, string | undefined>,
  lang: ContentLang,
): string {
  return resolveLocalizedText(noticeI18n, lang);
}

export function resolveReservationNote(
  reservationNoteI18n: Record<string, string | undefined>,
  lang: ContentLang,
): string {
  return resolveLocalizedText(reservationNoteI18n, lang);
}

export function resolveName(
  nameI18n: Record<string, string>,
  lang: ContentLang,
): string {
  return resolveLocalizedText(nameI18n, lang);
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

export function ensureTextI18n(
  raw: LocalizedTextMap | null | undefined,
  fallback: string,
): Record<string, string> {
  return {
    'zh-CN': raw?.['zh-CN']?.trim() || fallback,
    'en-US': raw?.['en-US']?.trim() || fallback,
    'mn-MN': raw?.['mn-MN']?.trim() || toCyrillicApprox(fallback),
  };
}

export function ensureRegionI18n(
  raw: LocalizedTextMap | null | undefined,
  fallback: string,
): Record<string, string> {
  return ensureTextI18n(raw, fallback);
}

export function ensureIntroI18n(
  raw: LocalizedTextMap | null | undefined,
): Record<string, string | undefined> {
  return {
    'zh-CN': raw?.['zh-CN']?.trim() ?? '',
    'en-US': raw?.['en-US']?.trim() ?? '',
    'mn-MN': raw?.['mn-MN']?.trim() ?? '',
  };
}

export function ensureGuideI18n(
  raw: LocalizedTextMap | null | undefined,
): Record<string, string | undefined> {
  return ensureIntroI18n(raw);
}

export function ensureNoticeI18n(
  raw: LocalizedTextMap | null | undefined,
): Record<string, string | undefined> {
  return ensureIntroI18n(raw);
}

export function ensureReservationNoteI18n(
  raw: LocalizedTextMap | null | undefined,
): Record<string, string | undefined> {
  return ensureIntroI18n(raw);
}

function resolveLocalizedText(
  i18n: LocalizedTextMap,
  lang: ContentLang,
): string {
  if (lang === 'zh-CN') {
    return i18n['zh-CN'] ?? i18n['en-US'] ?? i18n['mn-MN'] ?? '';
  }
  if (lang === 'en-US') {
    return i18n['en-US'] ?? i18n['mn-MN'] ?? i18n['zh-CN'] ?? '';
  }
  return i18n['mn-MN'] ?? i18n['en-US'] ?? i18n['zh-CN'] ?? '';
}
