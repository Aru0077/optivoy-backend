import dataSource from '../../../database/data-source';

interface TransitCacheStatsRow {
  total: string;
  ready: string;
  stale: string;
  failed: string;
  orphan: string;
}

interface TransitCacheCleanupResultRow {
  deleted_non_ready: string;
  deleted_orphan: string;
}

const EXISTING_POINTS_CTE = `
  WITH existing_points AS (
    SELECT id FROM spots
    UNION
    SELECT id FROM shopping_places
    UNION
    SELECT id FROM hotels
  )
`;

async function collectStats(): Promise<TransitCacheStatsRow> {
  const rows = await dataSource.query(
    `
      ${EXISTING_POINTS_CTE}
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'ready')::text AS ready,
        COUNT(*) FILTER (WHERE status = 'stale')::text AS stale,
        COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
        COUNT(*) FILTER (
          WHERE
            NOT EXISTS (
              SELECT 1
              FROM existing_points p
              WHERE p.id = c."fromPointId"
            )
            OR NOT EXISTS (
              SELECT 1
              FROM existing_points p
              WHERE p.id = c."toPointId"
            )
        )::text AS orphan
      FROM transit_cache c
    `,
  );
  return rows[0] as TransitCacheStatsRow;
}

async function cleanupTransitCache(): Promise<TransitCacheCleanupResultRow> {
  const rows = await dataSource.query(
    `
      ${EXISTING_POINTS_CTE},
      deleted_non_ready AS (
        DELETE FROM transit_cache
        WHERE status IN ('stale', 'failed')
        RETURNING id
      ),
      deleted_orphan AS (
        DELETE FROM transit_cache c
        WHERE
          NOT EXISTS (
            SELECT 1
            FROM existing_points p
            WHERE p.id = c."fromPointId"
          )
          OR NOT EXISTS (
            SELECT 1
            FROM existing_points p
            WHERE p.id = c."toPointId"
          )
        RETURNING id
      )
      SELECT
        (SELECT COUNT(*)::text FROM deleted_non_ready) AS deleted_non_ready,
        (SELECT COUNT(*)::text FROM deleted_orphan) AS deleted_orphan
    `,
  );
  return rows[0] as TransitCacheCleanupResultRow;
}

function toInt(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function run(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  await dataSource.initialize();

  try {
    const before = await collectStats();

    if (dryRun) {
      console.log('[transit-cache-cleanup] dry-run mode');
      console.log(
        JSON.stringify(
          {
            before: {
              total: toInt(before.total),
              ready: toInt(before.ready),
              stale: toInt(before.stale),
              failed: toInt(before.failed),
              orphan: toInt(before.orphan),
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    const deleted = await cleanupTransitCache();
    const after = await collectStats();

    console.log(
      JSON.stringify(
        {
          deleted: {
            nonReady: toInt(deleted.deleted_non_ready),
            orphan: toInt(deleted.deleted_orphan),
          },
          before: {
            total: toInt(before.total),
            ready: toInt(before.ready),
            stale: toInt(before.stale),
            failed: toInt(before.failed),
            orphan: toInt(before.orphan),
          },
          after: {
            total: toInt(after.total),
            ready: toInt(after.ready),
            stale: toInt(after.stale),
            failed: toInt(after.failed),
            orphan: toInt(after.orphan),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await dataSource.destroy();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[transit-cache-cleanup] failed: ${message}`);
  process.exitCode = 1;
});
