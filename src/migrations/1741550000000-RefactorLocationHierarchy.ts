import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class RefactorLocationHierarchy1741550000000 implements MigrationInterface {
  name = 'RefactorLocationHierarchy1741550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    const hasOldCities = await queryRunner.hasTable('location_cities');
    const hasOldAirports = await queryRunner.hasTable('location_airports');
    if (hasOldCities) {
      await queryRunner.query(
        'ALTER TABLE "location_cities" RENAME TO "location_cities_legacy"',
      );
      await this.renameLegacyCityObjects(queryRunner);
    }
    if (hasOldAirports) {
      await queryRunner.query(
        'ALTER TABLE "location_airports" RENAME TO "location_airports_legacy"',
      );
      await this.renameLegacyAirportObjects(queryRunner);
    }

    await queryRunner.createTable(
      new Table({
        name: 'location_provinces',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'country',
            type: 'varchar',
            length: '2',
            isNullable: false,
            default: "'CN'",
          },
          {
            name: 'name',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'nameI18n',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        uniques: [
          {
            name: 'UQ_location_provinces_country_name',
            columnNames: ['country', 'name'],
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'location_provinces',
      new TableIndex({
        name: 'IDX_location_provinces_country_name',
        columnNames: ['country', 'name'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'location_cities',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'provinceId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'nameI18n',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        uniques: [
          {
            name: 'UQ_location_cities_province_id_name',
            columnNames: ['provinceId', 'name'],
          },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'location_cities',
      new TableForeignKey({
        name: 'FK_location_cities_province_id',
        columnNames: ['provinceId'],
        referencedTableName: 'location_provinces',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'location_cities',
      new TableIndex({
        name: 'IDX_location_cities_province_id_name',
        columnNames: ['provinceId', 'name'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'location_airports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'cityId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'airportCode',
            type: 'varchar',
            length: '8',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'nameI18n',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'latitude',
            type: 'double precision',
            isNullable: true,
          },
          {
            name: 'longitude',
            type: 'double precision',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        uniques: [
          {
            name: 'UQ_location_airports_code',
            columnNames: ['airportCode'],
          },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'location_airports',
      new TableForeignKey({
        name: 'FK_location_airports_city_id',
        columnNames: ['cityId'],
        referencedTableName: 'location_cities',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'location_airports',
      new TableIndex({
        name: 'IDX_location_airports_city_id',
        columnNames: ['cityId'],
      }),
    );

    if (hasOldAirports && hasOldCities) {
      await queryRunner.query(`
        INSERT INTO "location_provinces"
          ("id", "country", "name", "nameI18n", "createdAt", "updatedAt")
        SELECT
          uuid_generate_v4(),
          'CN',
          trim(lc.province),
          COALESCE(
            lc."provinceI18n",
            jsonb_build_object('en-US', trim(lc.province), 'mn-MN', trim(lc.province))
          ),
          now(),
          now()
        FROM (
          SELECT DISTINCT lc.province, lc."provinceI18n"
          FROM "location_cities_legacy" lc
          INNER JOIN "location_airports_legacy" la ON la."cityId" = lc.id
          WHERE trim(lc.province) <> ''
        ) lc
        ON CONFLICT ("country", "name") DO NOTHING
      `);

      await queryRunner.query(`
        INSERT INTO "location_cities"
          ("id", "provinceId", "name", "nameI18n", "createdAt", "updatedAt")
        SELECT
          uuid_generate_v4(),
          lp.id,
          trim(lc.city),
          COALESCE(
            lc."cityI18n",
            jsonb_build_object('en-US', trim(lc.city), 'mn-MN', trim(lc.city))
          ),
          now(),
          now()
        FROM (
          SELECT DISTINCT lc.province, lc.city, lc."cityI18n"
          FROM "location_cities_legacy" lc
          INNER JOIN "location_airports_legacy" la ON la."cityId" = lc.id
          WHERE trim(lc.province) <> '' AND trim(lc.city) <> ''
        ) lc
        INNER JOIN "location_provinces" lp
          ON lp.country = 'CN'
         AND lp.name = trim(lc.province)
        ON CONFLICT ("provinceId", "name") DO NOTHING
      `);

      await queryRunner.query(`
        INSERT INTO "location_airports"
          ("id", "cityId", "airportCode", "name", "nameI18n", "latitude", "longitude", "createdAt", "updatedAt")
        SELECT
          uuid_generate_v4(),
          c.id,
          upper(trim(la."airportCode")),
          COALESCE(NULLIF(trim(la.name), ''), upper(trim(la."airportCode"))),
          COALESCE(
            la."nameI18n",
            jsonb_build_object(
              'en-US', COALESCE(NULLIF(trim(la.name), ''), upper(trim(la."airportCode"))),
              'mn-MN', COALESCE(NULLIF(trim(la.name), ''), upper(trim(la."airportCode")))
            )
          ),
          NULL,
          NULL,
          now(),
          now()
        FROM "location_airports_legacy" la
        INNER JOIN "location_cities_legacy" lc ON lc.id = la."cityId"
        INNER JOIN "location_provinces" lp
          ON lp.country = 'CN'
         AND lp.name = trim(lc.province)
        INNER JOIN "location_cities" c
          ON c."provinceId" = lp.id
         AND c.name = trim(lc.city)
        WHERE trim(la."airportCode") <> ''
        ON CONFLICT ("airportCode") DO NOTHING
      `);
    }

    await queryRunner.query(`
      INSERT INTO "location_provinces"
        ("id", "country", "name", "nameI18n", "createdAt", "updatedAt")
      SELECT
        uuid_generate_v4(),
        'CN',
        s.province,
        jsonb_build_object('en-US', s.province, 'mn-MN', s.province),
        now(),
        now()
      FROM (
        SELECT DISTINCT trim(province) AS province
        FROM spots
        WHERE trim(province) <> ''
      ) s
      ON CONFLICT ("country", "name") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "location_cities"
        ("id", "provinceId", "name", "nameI18n", "createdAt", "updatedAt")
      SELECT
        uuid_generate_v4(),
        lp.id,
        s.city,
        jsonb_build_object('en-US', s.city, 'mn-MN', s.city),
        now(),
        now()
      FROM (
        SELECT DISTINCT trim(province) AS province, trim(city) AS city
        FROM spots
        WHERE trim(province) <> '' AND trim(city) <> ''
      ) s
      INNER JOIN "location_provinces" lp
        ON lp.country = 'CN'
       AND lp.name = s.province
      ON CONFLICT ("provinceId", "name") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "location_airports"
        ("id", "cityId", "airportCode", "name", "nameI18n", "latitude", "longitude", "createdAt", "updatedAt")
      SELECT
        uuid_generate_v4(),
        c.id,
        s_dedup."airportCode",
        s_dedup."airportCode",
        jsonb_build_object('en-US', s_dedup."airportCode", 'mn-MN', s_dedup."airportCode"),
        s_dedup.latitude,
        s_dedup.longitude,
        now(),
        now()
      FROM (
        WITH grouped AS (
          SELECT
            trim(province) AS province,
            trim(city) AS city,
            upper(trim("airportCode")) AS "airportCode",
            AVG(latitude) AS latitude,
            AVG(longitude) AS longitude,
            COUNT(*)::int AS "spotCount"
          FROM spots
          WHERE trim(province) <> ''
            AND trim(city) <> ''
            AND trim("airportCode") <> ''
          GROUP BY trim(province), trim(city), upper(trim("airportCode"))
        ),
        ranked AS (
          SELECT
            grouped.*,
            ROW_NUMBER() OVER (
              PARTITION BY grouped."airportCode"
              ORDER BY
                (CASE
                  WHEN grouped.latitude IS NULL OR grouped.longitude IS NULL THEN 1
                  ELSE 0
                END) ASC,
                grouped."spotCount" DESC,
                grouped.province ASC,
                grouped.city ASC
            ) AS "rankNo"
          FROM grouped
        )
        SELECT
          ranked.province,
          ranked.city,
          ranked."airportCode",
          ranked.latitude,
          ranked.longitude
        FROM ranked
        WHERE ranked."rankNo" = 1
      ) s_dedup
      INNER JOIN "location_provinces" lp
        ON lp.country = 'CN'
       AND lp.name = s_dedup.province
      INNER JOIN "location_cities" c
        ON c."provinceId" = lp.id
       AND c.name = s_dedup.city
      ON CONFLICT ("airportCode") DO UPDATE
      SET
        latitude = COALESCE("location_airports".latitude, EXCLUDED.latitude),
        longitude = COALESCE("location_airports".longitude, EXCLUDED.longitude)
    `);

    const spotTable = await queryRunner.hasTable('spots');
    if (spotTable) {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS "IDX_spots_airport_code" ON "spots" ("airportCode")',
      );
      await queryRunner.createForeignKey(
        'spots',
        new TableForeignKey({
          name: 'FK_spots_airport_code',
          columnNames: ['airportCode'],
          referencedTableName: 'location_airports',
          referencedColumnNames: ['airportCode'],
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        }),
      );
    }

    if (hasOldAirports) {
      await queryRunner.query(
        'DROP TABLE IF EXISTS "location_airports_legacy" CASCADE',
      );
    }
    if (hasOldCities) {
      await queryRunner.query(
        'DROP TABLE IF EXISTS "location_cities_legacy" CASCADE',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const spotTable = await queryRunner.hasTable('spots');
    if (spotTable) {
      const spotsTable = await queryRunner.getTable('spots');
      const fk = spotsTable?.foreignKeys.find(
        (item) => item.name === 'FK_spots_airport_code',
      );
      if (fk) {
        await queryRunner.dropForeignKey('spots', fk);
      }
      await queryRunner.query(
        'DROP INDEX IF EXISTS "public"."IDX_spots_airport_code"',
      );
    }

    await queryRunner.dropIndex(
      'location_airports',
      'IDX_location_airports_city_id',
    );
    await queryRunner.dropForeignKey(
      'location_airports',
      'FK_location_airports_city_id',
    );
    await queryRunner.dropTable('location_airports', true);

    await queryRunner.dropIndex(
      'location_cities',
      'IDX_location_cities_province_id_name',
    );
    await queryRunner.dropForeignKey(
      'location_cities',
      'FK_location_cities_province_id',
    );
    await queryRunner.dropTable('location_cities', true);

    await queryRunner.dropIndex(
      'location_provinces',
      'IDX_location_provinces_country_name',
    );
    await queryRunner.dropTable('location_provinces', true);

    await queryRunner.createTable(
      new Table({
        name: 'location_cities',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'country',
            type: 'varchar',
            length: '2',
            isNullable: false,
            default: "'CN'",
          },
          {
            name: 'province',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'provinceI18n',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'city',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'cityI18n',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        uniques: [
          {
            name: 'UQ_location_cities_country_province_city',
            columnNames: ['country', 'province', 'city'],
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'location_cities',
      new TableIndex({
        name: 'IDX_location_cities_province_city',
        columnNames: ['province', 'city'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'location_airports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'cityId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'airportCode',
            type: 'varchar',
            length: '8',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'nameI18n',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        uniques: [
          {
            name: 'UQ_location_airports_code',
            columnNames: ['airportCode'],
          },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'location_airports',
      new TableForeignKey({
        name: 'FK_location_airports_city_id',
        columnNames: ['cityId'],
        referencedTableName: 'location_cities',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'location_airports',
      new TableIndex({
        name: 'IDX_location_airports_city_id',
        columnNames: ['cityId'],
      }),
    );
  }

  private async renameLegacyCityObjects(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE pk_name text;
      BEGIN
        SELECT conname INTO pk_name
        FROM pg_constraint
        WHERE conrelid = 'location_cities_legacy'::regclass
          AND contype = 'p'
        LIMIT 1;

        IF pk_name IS NOT NULL
          AND pk_name <> 'PK_location_cities_legacy_id'
          AND NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'PK_location_cities_legacy_id'
          )
        THEN
          EXECUTE format(
            'ALTER TABLE "location_cities_legacy" RENAME CONSTRAINT %I TO %I',
            pk_name,
            'PK_location_cities_legacy_id'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_location_cities_country_province_city'
        )
          AND NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'UQ_location_cities_legacy_country_province_city'
          )
        THEN
          ALTER TABLE "location_cities_legacy"
          RENAME CONSTRAINT "UQ_location_cities_country_province_city"
          TO "UQ_location_cities_legacy_country_province_city";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_class
          WHERE relkind = 'i' AND relname = 'IDX_location_cities_province_city'
        )
          AND NOT EXISTS (
            SELECT 1
            FROM pg_class
            WHERE relkind = 'i' AND relname = 'IDX_location_cities_legacy_province_city'
          )
        THEN
          ALTER INDEX "IDX_location_cities_province_city"
          RENAME TO "IDX_location_cities_legacy_province_city";
        END IF;
      END $$;
    `);
  }

  private async renameLegacyAirportObjects(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE pk_name text;
      BEGIN
        SELECT conname INTO pk_name
        FROM pg_constraint
        WHERE conrelid = 'location_airports_legacy'::regclass
          AND contype = 'p'
        LIMIT 1;

        IF pk_name IS NOT NULL
          AND pk_name <> 'PK_location_airports_legacy_id'
          AND NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'PK_location_airports_legacy_id'
          )
        THEN
          EXECUTE format(
            'ALTER TABLE "location_airports_legacy" RENAME CONSTRAINT %I TO %I',
            pk_name,
            'PK_location_airports_legacy_id'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_location_airports_code'
        )
          AND NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'UQ_location_airports_legacy_code'
          )
        THEN
          ALTER TABLE "location_airports_legacy"
          RENAME CONSTRAINT "UQ_location_airports_code"
          TO "UQ_location_airports_legacy_code";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_location_airports_city_id'
        )
          AND NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'FK_location_airports_legacy_city_id'
          )
        THEN
          ALTER TABLE "location_airports_legacy"
          RENAME CONSTRAINT "FK_location_airports_city_id"
          TO "FK_location_airports_legacy_city_id";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_class
          WHERE relkind = 'i' AND relname = 'IDX_location_airports_city_id'
        )
          AND NOT EXISTS (
            SELECT 1
            FROM pg_class
            WHERE relkind = 'i' AND relname = 'IDX_location_airports_legacy_city_id'
          )
        THEN
          ALTER INDEX "IDX_location_airports_city_id"
          RENAME TO "IDX_location_airports_legacy_city_id";
        END IF;
      END $$;
    `);
  }
}
