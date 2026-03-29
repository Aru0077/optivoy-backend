import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class SpotRegionI18n1741260000000 implements MigrationInterface {
  name = 'SpotRegionI18n1741260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('spots', [
      new TableColumn({
        name: 'provinceI18n',
        type: 'jsonb',
        isNullable: true,
      }),
      new TableColumn({
        name: 'cityI18n',
        type: 'jsonb',
        isNullable: true,
      }),
    ]);

    await queryRunner.query(`
      UPDATE "spots"
      SET "provinceI18n" = jsonb_build_object('en-US', "province", 'mn-MN', "province"),
          "cityI18n" = jsonb_build_object('en-US', "city", 'mn-MN', "city")
      WHERE "provinceI18n" IS NULL OR "cityI18n" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('spots', 'cityI18n');
    await queryRunner.dropColumn('spots', 'provinceI18n');
  }
}
