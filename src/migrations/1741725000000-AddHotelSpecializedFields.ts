import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotelSpecializedFields1741725000000 implements MigrationInterface {
  name = 'AddHotelSpecializedFields1741725000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "starLevel" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "foreignerFriendly" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "checkInTime" character varying(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "checkOutTime" character varying(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "bookingUrl" character varying(500)
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "pricePerNightMinCny" numeric(10,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "pricePerNightMaxCny" numeric(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "pricePerNightMaxCny"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "pricePerNightMinCny"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "bookingUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "checkOutTime"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "checkInTime"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "foreignerFriendly"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "starLevel"
    `);
  }
}
