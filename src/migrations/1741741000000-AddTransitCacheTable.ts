import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransitCacheTable1741741000000 implements MigrationInterface {
  name = 'AddTransitCacheTable1741741000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transit_cache" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "city" character varying(120) NOT NULL,
        "province" character varying(120),
        "fromPointId" uuid NOT NULL,
        "fromPointType" character varying(16) NOT NULL,
        "toPointId" uuid NOT NULL,
        "toPointType" character varying(16) NOT NULL,
        "transitMinutes" integer NOT NULL,
        "drivingMinutes" integer NOT NULL,
        "walkingMeters" integer NOT NULL,
        "transitSummary" text,
        "transitSummaryI18n" jsonb,
        "distanceKm" double precision NOT NULL,
        "provider" character varying(24) NOT NULL DEFAULT 'amap',
        "status" character varying(16) NOT NULL DEFAULT 'ready',
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transit_cache_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_transit_cache_from_to_not_equal" CHECK ("fromPointId" <> "toPointId"),
        CONSTRAINT "CHK_transit_cache_from_point_type" CHECK ("fromPointType" IN ('spot','shopping','restaurant','hotel','airport')),
        CONSTRAINT "CHK_transit_cache_to_point_type" CHECK ("toPointType" IN ('spot','shopping','restaurant','hotel','airport')),
        CONSTRAINT "CHK_transit_cache_status" CHECK ("status" IN ('ready','stale','failed'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transit_cache_city_from_to"
      ON "transit_cache" ("city", "fromPointId", "toPointId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transit_cache_city"
      ON "transit_cache" ("city")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transit_cache_from"
      ON "transit_cache" ("fromPointId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transit_cache_to"
      ON "transit_cache" ("toPointId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transit_cache_updated_at"
      ON "transit_cache" ("updatedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_transit_cache_updated_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_transit_cache_to"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_transit_cache_from"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_transit_cache_city"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_transit_cache_city_from_to"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "transit_cache"`);
  }
}
