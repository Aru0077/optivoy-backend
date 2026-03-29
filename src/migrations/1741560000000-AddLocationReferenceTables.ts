import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddLocationReferenceTables1741560000000 implements MigrationInterface {
  name = 'AddLocationReferenceTables1741560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCountries = await queryRunner.hasTable('location_country_refs');
    if (!hasCountries) {
      await queryRunner.createTable(
        new Table({
          name: 'location_country_refs',
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
              name: 'code',
              type: 'varchar',
              length: '2',
              isNullable: false,
            },
            {
              name: 'name',
              type: 'varchar',
              length: '120',
              isNullable: false,
            },
            {
              name: 'continent',
              type: 'varchar',
              length: '2',
              isNullable: true,
            },
            {
              name: 'wikipediaLink',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'keywords',
              type: 'text',
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
              name: 'UQ_location_country_refs_code',
              columnNames: ['code'],
            },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'location_country_refs',
        new TableIndex({
          name: 'IDX_location_country_refs_continent',
          columnNames: ['continent'],
        }),
      );
    }

    const hasRegions = await queryRunner.hasTable('location_region_refs');
    if (!hasRegions) {
      await queryRunner.createTable(
        new Table({
          name: 'location_region_refs',
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
              name: 'code',
              type: 'varchar',
              length: '16',
              isNullable: false,
            },
            {
              name: 'localCode',
              type: 'varchar',
              length: '16',
              isNullable: true,
            },
            {
              name: 'name',
              type: 'varchar',
              length: '160',
              isNullable: false,
            },
            {
              name: 'isoCountry',
              type: 'varchar',
              length: '2',
              isNullable: false,
            },
            {
              name: 'continent',
              type: 'varchar',
              length: '2',
              isNullable: true,
            },
            {
              name: 'wikipediaLink',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'keywords',
              type: 'text',
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
              name: 'UQ_location_region_refs_code',
              columnNames: ['code'],
            },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'location_region_refs',
        new TableIndex({
          name: 'IDX_location_region_refs_country',
          columnNames: ['isoCountry'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasRegions = await queryRunner.hasTable('location_region_refs');
    if (hasRegions) {
      await queryRunner.query(
        'DROP INDEX IF EXISTS "public"."IDX_location_region_refs_country"',
      );
      await queryRunner.dropTable('location_region_refs', true);
    }

    const hasCountries = await queryRunner.hasTable('location_country_refs');
    if (hasCountries) {
      await queryRunner.query(
        'DROP INDEX IF EXISTS "public"."IDX_location_country_refs_continent"',
      );
      await queryRunner.dropTable('location_country_refs', true);
    }
  }
}
