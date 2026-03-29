import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpotPlanningFields1741723000000 implements MigrationInterface {
  name = 'AddSpotPlanningFields1741723000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "suggestedDurationMinutes" integer NOT NULL DEFAULT 240
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "reservationRequired" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "reservationUrl" character varying(500)
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "reservationNoteI18n" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "closedWeekdays" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "ticketPriceMinCny" numeric(10,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "ticketPriceMaxCny" numeric(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "ticketPriceMaxCny"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "ticketPriceMinCny"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "closedWeekdays"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "reservationNoteI18n"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "reservationUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "reservationRequired"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "suggestedDurationMinutes"
    `);
  }
}
