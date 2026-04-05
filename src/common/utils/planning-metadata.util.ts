export interface PlanningTimeRange {
  start: string;
  end: string;
}

export interface OpeningHoursRule {
  weekday: number;
  periods: PlanningTimeRange[];
}

export interface QueueProfile {
  weekdayMinutes?: number;
  weekendMinutes?: number;
  holidayMinutes?: number;
}

export interface BestVisitWindow extends PlanningTimeRange {
  tag?: string;
}

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function ensureHm(value: string, label: string): string {
  const normalized = value.trim();
  if (!HHMM_PATTERN.test(normalized)) {
    throw new Error(`${label} must be formatted as HH:mm.`);
  }
  return normalized;
}

function ensureIsoDate(value: string, label: string): string {
  const normalized = value.trim();
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error(`${label} must be formatted as YYYY-MM-DD.`);
  }

  const seed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    !Number.isFinite(seed.getTime()) ||
    seed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error(`${label} contains an invalid calendar date.`);
  }

  return normalized;
}

export function compareHm(a: string, b: string): number {
  return a.localeCompare(b);
}

export function normalizeOpeningHours(
  input?: Array<{
    weekday: number;
    periods: Array<{ start: string; end: string }>;
  }> | null,
): OpeningHoursRule[] {
  if (!input?.length) {
    return [];
  }

  const rules = input.map((item, index) => {
    if (
      !Number.isInteger(item.weekday) ||
      item.weekday < 0 ||
      item.weekday > 6
    ) {
      throw new Error(
        `openingHoursJson[${index}].weekday must be an integer between 0 and 6.`,
      );
    }
    if (!Array.isArray(item.periods) || item.periods.length === 0) {
      throw new Error(
        `openingHoursJson[${index}].periods must contain at least one time range.`,
      );
    }

    const periods = item.periods.map((period, periodIndex) => {
      const start = ensureHm(
        period.start,
        `openingHoursJson[${index}].periods[${periodIndex}].start`,
      );
      const end = ensureHm(
        period.end,
        `openingHoursJson[${index}].periods[${periodIndex}].end`,
      );
      if (compareHm(start, end) >= 0) {
        throw new Error(
          `openingHoursJson[${index}].periods[${periodIndex}] must have start earlier than end.`,
        );
      }
      return { start, end };
    });

    return {
      weekday: item.weekday,
      periods: periods.sort((a, b) => compareHm(a.start, b.start)),
    };
  });

  const deduped = new Map<number, PlanningTimeRange[]>();
  for (const rule of rules) {
    deduped.set(rule.weekday, rule.periods);
  }

  return Array.from(deduped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, periods]) => ({ weekday, periods }));
}

export function normalizeSpecialDates(
  input?: string[] | null,
  label = 'specialClosureDates',
): string[] {
  if (!input?.length) {
    return [];
  }

  const normalized = input.map((value, index) =>
    ensureIsoDate(value, `${label}[${index}]`),
  );
  return Array.from(new Set(normalized)).sort();
}

export function normalizeTimeSlots(
  input?: string[] | null,
  label = 'reservationTimeSlotsJson',
): string[] {
  if (!input?.length) {
    return [];
  }

  const normalized = input.map((value, index) =>
    ensureHm(value, `${label}[${index}]`),
  );
  return Array.from(new Set(normalized)).sort(compareHm);
}

export function normalizeQueueProfile(
  input?: QueueProfile | null,
): QueueProfile | null {
  if (!input) {
    return null;
  }

  const allowedKeys = ['weekdayMinutes', 'weekendMinutes', 'holidayMinutes'];
  for (const key of Object.keys(input)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`queueProfileJson contains unsupported key "${key}".`);
    }
  }

  const profile: QueueProfile = {};
  for (const key of allowedKeys) {
    const value = input[key as keyof QueueProfile];
    if (value === undefined || value === null) {
      continue;
    }
    if (!Number.isInteger(value) || value < 0 || value > 1440) {
      throw new Error(
        `queueProfileJson.${key} must be an integer between 0 and 1440.`,
      );
    }
    profile[key as keyof QueueProfile] = value;
  }

  return Object.keys(profile).length > 0 ? profile : null;
}

export function normalizeBestVisitWindows(
  input?: Array<{ start: string; end: string; tag?: string }> | null,
): BestVisitWindow[] {
  if (!input?.length) {
    return [];
  }

  return input.map((item, index) => {
    const start = ensureHm(item.start, `bestVisitWindowsJson[${index}].start`);
    const end = ensureHm(item.end, `bestVisitWindowsJson[${index}].end`);
    if (compareHm(start, end) >= 0) {
      throw new Error(
        `bestVisitWindowsJson[${index}] must have start earlier than end.`,
      );
    }
    return {
      start,
      end,
      tag: item.tag?.trim() || undefined,
    };
  });
}

export function ensureCoordinatePair(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  label: string,
): void {
  const hasLatitude = typeof latitude === 'number' && Number.isFinite(latitude);
  const hasLongitude =
    typeof longitude === 'number' && Number.isFinite(longitude);

  if (hasLatitude !== hasLongitude) {
    throw new Error(
      `${label} must provide both latitude and longitude together.`,
    );
  }
}

export function latestClosingTime(
  openingHours: OpeningHoursRule[],
): string | null {
  let latest: string | null = null;
  for (const rule of openingHours) {
    for (const period of rule.periods) {
      if (latest === null || compareHm(period.end, latest) > 0) {
        latest = period.end;
      }
    }
  }
  return latest;
}
