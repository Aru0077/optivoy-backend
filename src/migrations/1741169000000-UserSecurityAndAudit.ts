import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class UserSecurityAndAudit1741169000000 implements MigrationInterface {
  name = 'UserSecurityAndAudit1741169000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TYPE \"user_status_enum\" AS ENUM('active', 'suspended', 'banned')",
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "status" "user_status_enum" NOT NULL DEFAULT \'active\'',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "statusReason" character varying',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD "emailVerifiedAt" TIMESTAMP',
    );

    await queryRunner.query(
      "CREATE TYPE \"user_security_token_type_enum\" AS ENUM('email_verification', 'password_reset')",
    );
    await queryRunner.createTable(
      new Table({
        name: 'user_security_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['email_verification', 'password_reset'],
            enumName: 'user_security_token_type_enum',
            isNullable: false,
          },
          {
            name: 'tokenHash',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'usedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_user_security_tokens_user_id',
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_security_tokens_token_hash" ON "user_security_tokens" ("tokenHash")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_security_tokens_user_type" ON "user_security_tokens" ("userId", "type")',
    );

    await queryRunner.query(
      "CREATE TYPE \"audit_actor_type_enum\" AS ENUM('admin', 'user', 'system')",
    );
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'actorType',
            type: 'enum',
            enum: ['admin', 'user', 'system'],
            enumName: 'audit_actor_type_enum',
            isNullable: false,
          },
          {
            name: 'actorId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'action',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'targetType',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'targetId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_audit_logs_action"');
    await queryRunner.query('DROP INDEX "public"."IDX_audit_logs_created_at"');
    await queryRunner.dropTable('audit_logs', true);
    await queryRunner.query('DROP TYPE "audit_actor_type_enum"');

    await queryRunner.query(
      'DROP INDEX "public"."IDX_user_security_tokens_user_type"',
    );
    await queryRunner.query(
      'DROP INDEX "public"."IDX_user_security_tokens_token_hash"',
    );
    await queryRunner.dropTable('user_security_tokens', true);
    await queryRunner.query('DROP TYPE "user_security_token_type_enum"');

    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "emailVerifiedAt"',
    );
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "statusReason"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "status"');
    await queryRunner.query('DROP TYPE "user_status_enum"');
  }
}
