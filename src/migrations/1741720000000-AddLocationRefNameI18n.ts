import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocationRefNameI18n1741720000000 implements MigrationInterface {
  name = 'AddLocationRefNameI18n1741720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "location_country_refs"
      ADD COLUMN IF NOT EXISTS "nameI18n" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "location_region_refs"
      ADD COLUMN IF NOT EXISTS "nameI18n" jsonb
    `);
    await queryRunner.query(`
      UPDATE "location_country_refs"
      SET "nameI18n" = jsonb_build_object(
        'zh-CN', "name",
        'en-US', "name",
        'mn-MN', "name"
      )
      WHERE "nameI18n" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "location_region_refs"
      SET "nameI18n" = jsonb_build_object(
        'zh-CN', "name",
        'en-US', "name",
        'mn-MN', "name"
      )
      WHERE "nameI18n" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "location_region_refs"
      DROP COLUMN IF EXISTS "nameI18n"
    `);
    await queryRunner.query(`
      ALTER TABLE "location_country_refs"
      DROP COLUMN IF EXISTS "nameI18n"
    `);
  }
}
