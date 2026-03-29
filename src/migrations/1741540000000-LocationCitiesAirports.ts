import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class LocationCitiesAirports1741540000000 implements MigrationInterface {
  name = 'LocationCitiesAirports1741540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
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
      'IDX_location_cities_province_city',
    );
    await queryRunner.dropTable('location_cities', true);
  }
}
