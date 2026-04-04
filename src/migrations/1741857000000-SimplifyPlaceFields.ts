import { MigrationInterface, QueryRunner } from 'typeorm';

export class SimplifyPlaceFields1741857000000 implements MigrationInterface {
  name = 'SimplifyPlaceFields1741857000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "hasFoodCourt" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "hasFoodCourt" boolean NOT NULL DEFAULT false
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
      DROP COLUMN IF EXISTS "bestVisitWindowsJson"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "closedWeekdays"
    `);

    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      DROP COLUMN IF EXISTS "openingHours"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      DROP COLUMN IF EXISTS "queueProfileJson"
    `);

    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "openingHours"
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "closedWeekdays"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "closedWeekdays" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "openingHours" character varying(120)
    `);

    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "queueProfileJson" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "openingHours" character varying(120)
    `);

    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "closedWeekdays" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "bestVisitWindowsJson" jsonb
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
      ALTER TABLE "shopping_places"
      DROP COLUMN IF EXISTS "hasFoodCourt"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "hasFoodCourt"
    `);
  }
}
