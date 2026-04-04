import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveHotelLegacyAvailabilityFields1741861000000
  implements MigrationInterface
{
  name = 'RemoveHotelLegacyAvailabilityFields1741861000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "foreignerFriendly"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "bookingStatus"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "bookableDatesJson"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "foreignerFriendly" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "bookingStatus" character varying(16)
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "bookableDatesJson" jsonb
    `);
  }
}
