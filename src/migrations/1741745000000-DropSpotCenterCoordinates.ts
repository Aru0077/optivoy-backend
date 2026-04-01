import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropSpotCenterCoordinates1741745000000
  implements MigrationInterface
{
  name = 'DropSpotCenterCoordinates1741745000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "longitude"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "latitude"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "latitude" double precision
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "longitude" double precision
    `);
  }
}
