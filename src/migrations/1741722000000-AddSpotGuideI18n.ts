import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpotGuideI18n1741722000000 implements MigrationInterface {
  name = 'AddSpotGuideI18n1741722000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "guideI18n" jsonb
    `);
    await queryRunner.query(`
      UPDATE "spots"
      SET "guideI18n" = COALESCE("introI18n", '{}'::jsonb)
      WHERE "guideI18n" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "guideI18n"
    `);
  }
}
