import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaceNoticeI18n1741742000000 implements MigrationInterface {
  name = 'AddPlaceNoticeI18n1741742000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "noticeI18n" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      ADD COLUMN IF NOT EXISTS "noticeI18n" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "noticeI18n" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "noticeI18n" jsonb
    `);

    await queryRunner.query(`
      UPDATE "spots"
      SET "noticeI18n" = "guideI18n"
      WHERE "noticeI18n" IS NULL AND "guideI18n" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "shopping_places"
      SET "noticeI18n" = "guideI18n"
      WHERE "noticeI18n" IS NULL AND "guideI18n" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "hotels"
      SET "noticeI18n" = "guideI18n"
      WHERE "noticeI18n" IS NULL AND "guideI18n" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "restaurants"
      SET "noticeI18n" = "guideI18n"
      WHERE "noticeI18n" IS NULL AND "guideI18n" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "noticeI18n"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
      DROP COLUMN IF EXISTS "noticeI18n"
    `);
    await queryRunner.query(`
      ALTER TABLE "shopping_places"
      DROP COLUMN IF EXISTS "noticeI18n"
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      DROP COLUMN IF EXISTS "noticeI18n"
    `);
  }
}

