import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAppRefreshTokens1741590000000 implements MigrationInterface {
  name = 'UserAppRefreshTokens1741590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD "hashedAppRefreshToken" character varying(255)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "hashedAppRefreshToken"',
    );
  }
}
