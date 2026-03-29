import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class SpotGuideI18n1741610000000 implements MigrationInterface {
  name = 'SpotGuideI18n1741610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'spots',
      new TableColumn({
        name: 'guideI18n',
        type: 'jsonb',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('spots', 'guideI18n');
  }
}
