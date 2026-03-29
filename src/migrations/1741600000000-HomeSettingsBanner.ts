import { MigrationInterface, QueryRunner } from 'typeorm';

export class HomeSettingsBanner1741600000000 implements MigrationInterface {
  name = 'HomeSettingsBanner1741600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "home_settings" (
        "key" character varying(64) NOT NULL,
        "value" text NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_home_settings_key" PRIMARY KEY ("key")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "home_settings"');
  }
}
