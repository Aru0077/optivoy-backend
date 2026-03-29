import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class SpotProvinceAndCityIndex1741224000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'spots',
      new TableColumn({
        name: 'province',
        type: 'varchar',
        length: '120',
        isNullable: false,
        default: "''",
      }),
    );

    await queryRunner.createIndex(
      'spots',
      new TableIndex({
        name: 'IDX_spots_is_published_province_city',
        columnNames: ['isPublished', 'province', 'city'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'spots',
      'IDX_spots_is_published_province_city',
    );
    await queryRunner.dropColumn('spots', 'province');
  }
}
