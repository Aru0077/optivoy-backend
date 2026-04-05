import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRestaurantsAndAirportPlanningFields1741862000000 implements MigrationInterface {
  name = 'RemoveRestaurantsAndAirportPlanningFields1741862000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "transit_cache"
      WHERE "fromPointType" IN ('restaurant', 'airport')
         OR "toPointType" IN ('restaurant', 'airport')
    `);

    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      DROP CONSTRAINT IF EXISTS "CHK_transit_cache_from_point_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      DROP CONSTRAINT IF EXISTS "CHK_transit_cache_to_point_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      ADD CONSTRAINT "CHK_transit_cache_from_point_type"
      CHECK ("fromPointType" IN ('spot', 'shopping', 'hotel'))
    `);
    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      ADD CONSTRAINT "CHK_transit_cache_to_point_type"
      CHECK ("toPointType" IN ('spot', 'shopping', 'hotel'))
    `);

    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "arrivalBufferMinutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "departureBufferMinutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "arrivalAnchorLatitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "arrivalAnchorLongitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "departureAnchorLatitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "departureAnchorLongitude"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "restaurants"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "restaurants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurants_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "location_airports"
      ADD COLUMN IF NOT EXISTS "arrivalBufferMinutes" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      ADD COLUMN IF NOT EXISTS "departureBufferMinutes" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      ADD COLUMN IF NOT EXISTS "arrivalAnchorLatitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      ADD COLUMN IF NOT EXISTS "arrivalAnchorLongitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      ADD COLUMN IF NOT EXISTS "departureAnchorLatitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      ADD COLUMN IF NOT EXISTS "departureAnchorLongitude" double precision
    `);

    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      DROP CONSTRAINT IF EXISTS "CHK_transit_cache_from_point_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      DROP CONSTRAINT IF EXISTS "CHK_transit_cache_to_point_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      ADD CONSTRAINT "CHK_transit_cache_from_point_type"
      CHECK ("fromPointType" IN ('spot', 'shopping', 'restaurant', 'hotel', 'airport'))
    `);
    await queryRunner.query(`
      ALTER TABLE "transit_cache"
      ADD CONSTRAINT "CHK_transit_cache_to_point_type"
      CHECK ("toPointType" IN ('spot', 'shopping', 'restaurant', 'hotel', 'airport'))
    `);
  }
}
