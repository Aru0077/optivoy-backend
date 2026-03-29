import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShoppingAndHotelTables1741724000000 implements MigrationInterface {
  name = 'AddShoppingAndHotelTables1741724000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "spots"
      SET "placeType" = 'attraction'
      WHERE "placeType" = 'shopping'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shopping_places" (
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
        "suggestedDurationMinutes" integer NOT NULL DEFAULT 240,
        "reservationRequired" boolean NOT NULL DEFAULT false,
        "reservationUrl" character varying(500),
        "reservationNoteI18n" jsonb,
        "closedWeekdays" jsonb,
        "ticketPriceMinCny" numeric(10,2),
        "ticketPriceMaxCny" numeric(10,2),
        "isPublished" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shopping_places_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shopping_places_country"
      ON "shopping_places" ("country")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shopping_places_province_city"
      ON "shopping_places" ("province", "city")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shopping_places_is_published"
      ON "shopping_places" ("isPublished")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shopping_places_created_at"
      ON "shopping_places" ("createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotels" (
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
        "suggestedDurationMinutes" integer NOT NULL DEFAULT 240,
        "reservationRequired" boolean NOT NULL DEFAULT false,
        "reservationUrl" character varying(500),
        "reservationNoteI18n" jsonb,
        "closedWeekdays" jsonb,
        "ticketPriceMinCny" numeric(10,2),
        "ticketPriceMaxCny" numeric(10,2),
        "isPublished" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotels_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotels_country"
      ON "hotels" ("country")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotels_province_city"
      ON "hotels" ("province", "city")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotels_is_published"
      ON "hotels" ("isPublished")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotels_created_at"
      ON "hotels" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_hotels_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_hotels_is_published"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_hotels_province_city"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_hotels_country"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "hotels"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_shopping_places_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_shopping_places_is_published"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_shopping_places_province_city"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_shopping_places_country"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "shopping_places"`);
  }
}
