import dataSource from '../../../database/data-source';
import { latestClosingTime, type OpeningHoursRule } from '../../../common/utils/planning-metadata.util';
import { ShoppingPlace } from '../../shopping/entities/shopping.entity';
import { Spot } from '../../spots/entities/spot.entity';

interface BackfillSummary {
  dryRun: boolean;
  spotsScanned: number;
  spotsUpdated: number;
  spotsOpeningHoursBackfilled: number;
  spotsLastEntryBackfilled: number;
  shoppingScanned: number;
  shoppingUpdated: number;
  shoppingOpeningHoursBackfilled: number;
  shoppingParsedFromLegacyText: number;
  shoppingDefaulted: number;
  samples: Array<{
    pointType: 'spot' | 'shopping';
    id: string;
    name: string;
    changed: string[];
  }>;
}

function buildUniformOpeningHours(
  start: string,
  end: string,
): OpeningHoursRule[] {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    periods: [{ start, end }],
  }));
}

function hasOpeningHours(input?: OpeningHoursRule[] | null): boolean {
  return Array.isArray(input) && input.length > 0;
}

function deriveLastEntryTime(openingHoursJson: OpeningHoursRule[]): string | null {
  const latestClose = latestClosingTime(openingHoursJson);
  if (!latestClose) {
    return null;
  }
  const [hours, minutes] = latestClose.split(':').map((item) => Number(item));
  const totalMinutes = hours * 60 + minutes;
  const fallbackMinutes = Math.max(0, totalMinutes - 60);
  const fallbackHour = Math.floor(fallbackMinutes / 60)
    .toString()
    .padStart(2, '0');
  const fallbackMinute = (fallbackMinutes % 60).toString().padStart(2, '0');
  return `${fallbackHour}:${fallbackMinute}`;
}

async function run(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const summary: BackfillSummary = {
    dryRun,
    spotsScanned: 0,
    spotsUpdated: 0,
    spotsOpeningHoursBackfilled: 0,
    spotsLastEntryBackfilled: 0,
    shoppingScanned: 0,
    shoppingUpdated: 0,
    shoppingOpeningHoursBackfilled: 0,
    shoppingParsedFromLegacyText: 0,
    shoppingDefaulted: 0,
    samples: [],
  };

  await dataSource.initialize();

  try {
    const spotRepository = dataSource.getRepository(Spot);
    const shoppingRepository = dataSource.getRepository(ShoppingPlace);

    const spots = await spotRepository.find();
    summary.spotsScanned = spots.length;

    for (const spot of spots) {
      const changed: string[] = [];
      let nextOpeningHours = spot.openingHoursJson ?? null;
      let nextLastEntryTime = spot.lastEntryTime?.trim() || null;

      if (!hasOpeningHours(nextOpeningHours)) {
        nextOpeningHours = buildUniformOpeningHours('09:00', '18:00');
        changed.push('openingHoursJson');
        summary.spotsOpeningHoursBackfilled += 1;
      }

      if (!nextLastEntryTime) {
        nextLastEntryTime = deriveLastEntryTime(nextOpeningHours ?? []);
        if (nextLastEntryTime) {
          changed.push('lastEntryTime');
          summary.spotsLastEntryBackfilled += 1;
        }
      }

      if (changed.length === 0) {
        continue;
      }

      if (!dryRun) {
        spot.openingHoursJson = nextOpeningHours;
        spot.lastEntryTime = nextLastEntryTime;
        await spotRepository.save(spot);
      }

      summary.spotsUpdated += 1;
      if (summary.samples.length < 20) {
        summary.samples.push({
          pointType: 'spot',
          id: spot.id,
          name: spot.name,
          changed,
        });
      }
    }

    const shoppingItems = await shoppingRepository.find();
    summary.shoppingScanned = shoppingItems.length;

    for (const item of shoppingItems) {
      if (hasOpeningHours(item.openingHoursJson)) {
        continue;
      }

      const nextOpeningHours = buildUniformOpeningHours('10:00', '22:00');
      summary.shoppingDefaulted += 1;

      if (!dryRun) {
        item.openingHoursJson = nextOpeningHours;
        await shoppingRepository.save(item);
      }

      summary.shoppingOpeningHoursBackfilled += 1;
      summary.shoppingUpdated += 1;
      if (summary.samples.length < 20) {
        summary.samples.push({
          pointType: 'shopping',
          id: item.id,
          name: item.name,
          changed: ['openingHoursJson'],
        });
      }
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[planning-metadata-backfill] failed: ${message}`);
  process.exitCode = 1;
});
