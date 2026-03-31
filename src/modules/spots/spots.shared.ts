export {
  resolveGuide,
  resolveIntro,
  resolveName,
  resolveReservationNote,
  toCyrillicApprox,
  toNullableNumber,
} from '../../common/utils/content-i18n.util';

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
