import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpotStaminaFactor1741866000000 implements MigrationInterface {
  name = 'AddSpotStaminaFactor1741866000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "spots"
        ADD COLUMN IF NOT EXISTS "staminaFactor" double precision NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "spots"
        DROP COLUMN IF EXISTS "staminaFactor"`,
    );
  }
}
