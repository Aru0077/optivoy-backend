import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class SpotCoordinates1741275000000 implements MigrationInterface {
  name = 'SpotCoordinates1741275000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('spots', [
      new TableColumn({
        name: 'latitude',
        type: 'double precision',
        isNullable: true,
      }),
      new TableColumn({
        name: 'longitude',
        type: 'double precision',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('spots', 'longitude');
    await queryRunner.dropColumn('spots', 'latitude');
  }
}
