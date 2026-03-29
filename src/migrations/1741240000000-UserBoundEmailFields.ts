import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserBoundEmailFields1741240000000 implements MigrationInterface {
  name = 'UserBoundEmailFields1741240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN "boundEmail" character varying(254)',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN "pendingEmail" character varying(254)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_users_bound_email" ON "users" ("boundEmail") WHERE "boundEmail" IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."UQ_users_bound_email"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "pendingEmail"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "boundEmail"');
  }
}
