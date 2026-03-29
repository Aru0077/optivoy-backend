import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparateShoppingHotelFields1741726000000 implements MigrationInterface {
  name = 'SeparateShoppingHotelFields1741726000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "openingHours" character varying(120)
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "avgSpendMinCny" numeric(10,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "avgSpendMaxCny" numeric(10,2)
    `);

    await queryRunner.query(`
      UPDATE "shopping_places"
      SET "avgSpendMinCny" = "ticketPriceMinCny"
      WHERE "avgSpendMinCny" IS NULL AND "ticketPriceMinCny" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "shopping_places"
      SET "avgSpendMaxCny" = "ticketPriceMaxCny"
      WHERE "avgSpendMaxCny" IS NULL AND "ticketPriceMaxCny" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "shopping_places" DROP COLUMN IF EXISTS "reservationRequired"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places" DROP COLUMN IF EXISTS "reservationUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places" DROP COLUMN IF EXISTS "reservationNoteI18n"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places" DROP COLUMN IF EXISTS "closedWeekdays"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places" DROP COLUMN IF EXISTS "ticketPriceMinCny"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places" DROP COLUMN IF EXISTS "ticketPriceMaxCny"
    `);

    await queryRunner.query(`
      ALTER TABLE "hotels" DROP COLUMN IF EXISTS "suggestedDurationMinutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels" DROP COLUMN IF EXISTS "reservationRequired"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels" DROP COLUMN IF EXISTS "reservationUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels" DROP COLUMN IF EXISTS "reservationNoteI18n"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels" DROP COLUMN IF EXISTS "closedWeekdays"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels" DROP COLUMN IF EXISTS "ticketPriceMinCny"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels" DROP COLUMN IF EXISTS "ticketPriceMaxCny"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "suggestedDurationMinutes" integer NOT NULL DEFAULT 240
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "reservationRequired" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "reservationUrl" character varying(500)
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "reservationNoteI18n" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "closedWeekdays" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "ticketPriceMinCny" numeric(10,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "ticketPriceMaxCny" numeric(10,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "reservationRequired" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "reservationUrl" character varying(500)
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "reservationNoteI18n" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "closedWeekdays" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "ticketPriceMinCny" numeric(10,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "ticketPriceMaxCny" numeric(10,2)
    `);

    await queryRunner.query(`
      UPDATE "shopping_places"
      SET "ticketPriceMinCny" = "avgSpendMinCny"
      WHERE "ticketPriceMinCny" IS NULL AND "avgSpendMinCny" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "shopping_places"
      SET "ticketPriceMaxCny" = "avgSpendMaxCny"
      WHERE "ticketPriceMaxCny" IS NULL AND "avgSpendMaxCny" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "shopping_places" DROP COLUMN IF EXISTS "avgSpendMaxCny"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places" DROP COLUMN IF EXISTS "avgSpendMinCny"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places" DROP COLUMN IF EXISTS "openingHours"
    `);
  }
}
