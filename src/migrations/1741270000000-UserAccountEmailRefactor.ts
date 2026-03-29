import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAccountEmailRefactor1741270000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Rename users.email (login account) to users.account
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "email" TO "account"`,
    );

    // 2. Rename the unique index on the login account column.
    // TypeORM named it "UQ_users_email" after table+column; the hash-based name
    // is a fallback in case the database was set up differently.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'UQ_users_email' AND relkind = 'i') THEN
          ALTER INDEX "UQ_users_email" RENAME TO "UQ_users_account";
        ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'UQ_97672ac88f789774dd47f7c8be3' AND relkind = 'i') THEN
          ALTER INDEX "UQ_97672ac88f789774dd47f7c8be3" RENAME TO "UQ_users_account";
        END IF;
      END $$;
    `);

    // 3. Rename users.boundEmail (verified email) to users.email
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "boundEmail" TO "email"`,
    );

    // 4. Rename the unique index on the email column
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "UQ_users_bound_email" RENAME TO "UQ_users_email"`,
    );

    // 5. Drop users.pendingEmail (replaced by token.targetEmail)
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "pendingEmail"`,
    );

    // 6. Add targetEmail column to user_security_tokens
    await queryRunner.query(
      `ALTER TABLE "user_security_tokens" ADD COLUMN IF NOT EXISTS "targetEmail" varchar(254) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order

    await queryRunner.query(
      `ALTER TABLE "user_security_tokens" DROP COLUMN IF EXISTS "targetEmail"`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pendingEmail" varchar(254) NULL`,
    );

    await queryRunner.query(
      `ALTER INDEX IF EXISTS "UQ_users_email" RENAME TO "UQ_users_bound_email"`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "email" TO "boundEmail"`,
    );

    await queryRunner.query(
      `ALTER INDEX IF EXISTS "UQ_users_account" RENAME TO "UQ_users_email"`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "account" TO "email"`,
    );
  }
}
