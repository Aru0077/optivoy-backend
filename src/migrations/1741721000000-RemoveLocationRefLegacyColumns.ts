import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveLocationRefLegacyColumns1741721000000 implements MigrationInterface {
  name = 'RemoveLocationRefLegacyColumns1741721000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "location_country_refs"
      DROP COLUMN IF EXISTS "wikipediaLink"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_country_refs"
      DROP COLUMN IF EXISTS "keywords"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_region_refs"
      DROP COLUMN IF EXISTS "wikipediaLink"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_region_refs"
      DROP COLUMN IF EXISTS "keywords"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "location_country_refs"
      ADD COLUMN IF NOT EXISTS "wikipediaLink" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "location_country_refs"
      ADD COLUMN IF NOT EXISTS "keywords" text
    `);
    await queryRunner.query(`
      ALTER TABLE "location_region_refs"
      ADD COLUMN IF NOT EXISTS "wikipediaLink" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "location_region_refs"
      ADD COLUMN IF NOT EXISTS "keywords" text
    `);
  }
}
