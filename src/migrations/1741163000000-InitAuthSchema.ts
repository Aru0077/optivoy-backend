import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class InitAuthSchema1741163000000 implements MigrationInterface {
  name = 'InitAuthSchema1741163000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.createTable(
      new Table({
        name: 'admins',
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
            name: 'email',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'password',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'hashedRefreshToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        uniques: [{ name: 'UQ_admins_email', columnNames: ['email'] }],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'users',
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
            name: 'email',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'avatar',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'passwordHash',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'hashedRefreshToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        uniques: [{ name: 'UQ_users_email', columnNames: ['email'] }],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_oauth_identities',
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
            name: 'provider',
            type: 'enum',
            enum: ['google', 'facebook'],
            enumName: 'provider_enum',
            isNullable: false,
          },
          {
            name: 'providerUserId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'providerEmail',
            type: 'varchar',
            isNullable: true,
          },
        ],
        uniques: [
          {
            name: 'UQ_provider_provider_user_id',
            columnNames: ['provider', 'providerUserId'],
          },
          {
            name: 'UQ_user_provider',
            columnNames: ['userId', 'provider'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'user_oauth_identities',
      new TableForeignKey({
        name: 'FK_user_oauth_identities_user_id',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'user_oauth_identities',
      'FK_user_oauth_identities_user_id',
    );
    await queryRunner.dropTable('user_oauth_identities', true);
    await queryRunner.dropTable('users', true);
    await queryRunner.dropTable('admins', true);
    await queryRunner.query('DROP TYPE IF EXISTS "provider_enum"');
  }
}
