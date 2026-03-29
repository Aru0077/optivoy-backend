import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class SpotNameI18n1741250000000 implements MigrationInterface {
  name = 'SpotNameI18n1741250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'spots',
      new TableColumn({
        name: 'nameI18n',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    await queryRunner.query(`
      UPDATE "spots"
      SET "nameI18n" = jsonb_build_object('mn-MN', "name", 'en-US', "name")
      WHERE "nameI18n" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('spots', 'nameI18n');
  }
}
