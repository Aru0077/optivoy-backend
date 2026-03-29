import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSpotLegacyFields1741710000000 implements MigrationInterface {
  name = 'RemoveSpotLegacyFields1741710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_spots_published_weight_created"',
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_spots_airport_code'
        ) THEN
          ALTER TABLE "spots" DROP CONSTRAINT "FK_spots_airport_code";
        END IF;
      END$$;
    `);
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_spots_airport_code"',
    );

    await queryRunner.query(
      'ALTER TABLE "spots" DROP COLUMN IF EXISTS "airportCode"',
    );
    await queryRunner.query(
      'ALTER TABLE "spots" DROP COLUMN IF EXISTS "imageUrls"',
    );
    await queryRunner.query('ALTER TABLE "spots" DROP COLUMN IF EXISTS "tags"');
    await queryRunner.query(
      'ALTER TABLE "spots" DROP COLUMN IF EXISTS "bestSeasons"',
    );
    await queryRunner.query(
      'ALTER TABLE "spots" DROP COLUMN IF EXISTS "guideI18n"',
    );
    await queryRunner.query(
      'ALTER TABLE "spots" DROP COLUMN IF EXISTS "adminWeight"',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "airportCode" varchar(8)
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "imageUrls" varchar[] NOT NULL DEFAULT '{}'
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "tags" varchar[] NOT NULL DEFAULT '{}'
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "bestSeasons" varchar[] NOT NULL DEFAULT '{}'
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "guideI18n" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "spots"
      ADD COLUMN IF NOT EXISTS "adminWeight" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_spots_published_weight_created" ON "spots" ("isPublished", "adminWeight" DESC, "createdAt" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_spots_airport_code" ON "spots" ("airportCode")',
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'spots' AND column_name = 'airportCode'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'location_airports' AND column_name = 'airportCode'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_spots_airport_code'
        ) THEN
          ALTER TABLE "spots"
            ADD CONSTRAINT "FK_spots_airport_code"
            FOREIGN KEY ("airportCode")
            REFERENCES "location_airports"("airportCode")
            ON DELETE RESTRICT
            ON UPDATE CASCADE;
        END IF;
      END$$;
    `);
  }
}
