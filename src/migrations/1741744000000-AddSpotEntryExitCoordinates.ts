import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpotEntryExitCoordinates1741744000000 implements MigrationInterface {
  name = 'AddSpotEntryExitCoordinates1741744000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "entryLatitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "entryLongitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "exitLatitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "exitLongitude" double precision
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "exitLongitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "exitLatitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "entryLongitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "entryLatitude"
    `);
  }
}
