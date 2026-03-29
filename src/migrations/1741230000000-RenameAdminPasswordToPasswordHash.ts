import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameAdminPasswordToPasswordHash1741230000000 implements MigrationInterface {
  name = 'RenameAdminPasswordToPasswordHash1741230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admins" RENAME COLUMN "password" TO "passwordHash"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admins" RENAME COLUMN "passwordHash" TO "password"`,
    );
  }
}
