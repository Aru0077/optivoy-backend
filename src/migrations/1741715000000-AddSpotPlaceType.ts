import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpotPlaceType1741715000000 implements MigrationInterface {
  name = 'AddSpotPlaceType1741715000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "placeType" varchar(32) NOT NULL DEFAULT 'attraction'
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_spots_place_type" ON "spots" ("placeType")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_spots_place_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "spots" DROP COLUMN IF EXISTS "placeType"`,
    );
  }
}
