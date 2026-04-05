import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransitCacheWalkingMinutesAndTransitProviderStatus1741747000000 implements MigrationInterface {
  name = 'AddTransitCacheWalkingMinutesAndTransitProviderStatus1741747000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      ADD COLUMN IF NOT EXISTS "walkingMinutes" integer
    `);
    await queryRunner.query(`
      UPDATE "transit_cache"
      SET "walkingMinutes" = GREATEST(1, ROUND("walkingMeters" / 83.0))
      WHERE "walkingMinutes" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      ALTER COLUMN "walkingMinutes" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      ADD COLUMN IF NOT EXISTS "transitProviderStatus" character varying(16)
    `);
    await queryRunner.query(`
      UPDATE "transit_cache"
      SET "transitProviderStatus" = CASE
        WHEN "transitSummary" IS NOT NULL THEN 'ready'
        ELSE 'fallback'
      END
      WHERE "transitProviderStatus" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      DROP COLUMN IF EXISTS "transitProviderStatus"
    `);
    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      DROP COLUMN IF EXISTS "walkingMinutes"
    `);
  }
}
