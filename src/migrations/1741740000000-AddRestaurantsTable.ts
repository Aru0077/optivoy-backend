import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestaurantsTable1741740000000 implements MigrationInterface {
  name = 'AddRestaurantsTable1741740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "restaurants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "nameI18n" jsonb,
        "country" character varying(2) NOT NULL DEFAULT 'CN',
        "province" character varying(120) NOT NULL DEFAULT '',
        "provinceI18n" jsonb,
        "city" character varying(120) NOT NULL,
        "cityI18n" jsonb,
        "latitude" double precision,
        "longitude" double precision,
        "coverImageUrl" character varying(500),
        "introI18n" jsonb NOT NULL,
        "guideI18n" jsonb,
        "openingHours" character varying(120),
        "closedWeekdays" jsonb,
        "suggestedDurationMinutes" integer NOT NULL DEFAULT 90,
        "mealSlots" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "cuisineTags" jsonb,
        "reservationRequired" boolean NOT NULL DEFAULT false,
        "reservationUrl" character varying(500),
        "avgSpendMinCny" numeric(10,2),
        "avgSpendMaxCny" numeric(10,2),
        "isPublished" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurants_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_restaurants_country"
      ON "restaurants" ("country")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_restaurants_province_city"
      ON "restaurants" ("province", "city")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_restaurants_is_published"
      ON "restaurants" ("isPublished")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_restaurants_created_at"
      ON "restaurants" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_restaurants_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_restaurants_is_published"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_restaurants_province_city"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_restaurants_country"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurants"`);
  }
}
