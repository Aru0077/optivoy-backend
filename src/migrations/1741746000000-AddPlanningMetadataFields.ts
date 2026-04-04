import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlanningMetadataFields1741746000000
  implements MigrationInterface
{
  name = 'AddPlanningMetadataFields1741746000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "openingHoursJson" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "specialClosureDates" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "lastEntryTime" character varying(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "reservationCutoffMinutes" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "reservationTimeSlotsJson" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "queueProfileJson" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "bestVisitWindowsJson" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "arrivalAnchorLatitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "arrivalAnchorLongitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "departureAnchorLatitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "departureAnchorLongitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "openingHoursJson" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "specialClosureDates" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "queueProfileJson" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "arrivalAnchorLatitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "arrivalAnchorLongitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "departureAnchorLatitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "departureAnchorLongitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "mealTimeWindowsJson" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "queueProfileJson" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "arrivalAnchorLatitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "arrivalAnchorLongitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "departureAnchorLatitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "departureAnchorLongitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "bookingStatus" character varying(16)
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "bookableDatesJson" jsonb
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "departureAnchorLongitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "departureAnchorLatitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "arrivalAnchorLongitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "arrivalAnchorLatitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "departureBufferMinutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_airports"
      DROP COLUMN IF EXISTS "arrivalBufferMinutes"
    `);

    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "bookableDatesJson"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "bookingStatus"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "departureAnchorLongitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "departureAnchorLatitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "arrivalAnchorLongitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "arrivalAnchorLatitude"
    `);

    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "queueProfileJson"
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "mealTimeWindowsJson"
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "departureAnchorLongitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "departureAnchorLatitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "arrivalAnchorLongitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "arrivalAnchorLatitude"
    `);

    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      DROP COLUMN IF EXISTS "queueProfileJson"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      DROP COLUMN IF EXISTS "specialClosureDates"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      DROP COLUMN IF EXISTS "openingHoursJson"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      DROP COLUMN IF EXISTS "departureAnchorLongitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      DROP COLUMN IF EXISTS "departureAnchorLatitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      DROP COLUMN IF EXISTS "arrivalAnchorLongitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      DROP COLUMN IF EXISTS "arrivalAnchorLatitude"
    `);

    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "bestVisitWindowsJson"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "queueProfileJson"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "reservationTimeSlotsJson"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "reservationCutoffMinutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "lastEntryTime"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "specialClosureDates"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "openingHoursJson"
    `);
  }
}
