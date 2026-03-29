import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class UploadBatches1741580000000 implements MigrationInterface {
  name = 'UploadBatches1741580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'upload_batches',
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
            name: 'actorRole',
            type: 'varchar',
            length: '16',
            isNullable: false,
          },
          {
            name: 'actorId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'folder',
            type: 'varchar',
            length: '120',
            isNullable: true,
          },
          {
            name: 'dir',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'allowedCount',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'expiresAt',
            type: 'timestamptz',
            isNullable: false,
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
      }),
      true,
    );

    await queryRunner.createIndex(
      'upload_batches',
      new TableIndex({
        name: 'IDX_upload_batches_actor_expires_at',
        columnNames: ['actorRole', 'actorId', 'expiresAt'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'upload_batch_items',
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
            name: 'batchId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'objectKey',
            type: 'varchar',
            length: '512',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '16',
            isNullable: false,
          },
          {
            name: 'size',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'mimeType',
            type: 'varchar',
            length: '120',
            isNullable: true,
          },
          {
            name: 'moderationStatus',
            type: 'varchar',
            length: '16',
            isNullable: true,
          },
          {
            name: 'moderationRequestId',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'moderationRiskLevel',
            type: 'varchar',
            length: '64',
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
        uniques: [
          {
            name: 'UQ_upload_batch_items_batch_key',
            columnNames: ['batchId', 'objectKey'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'upload_batch_items',
      new TableForeignKey({
        name: 'FK_upload_batch_items_batch_id',
        columnNames: ['batchId'],
        referencedTableName: 'upload_batches',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'upload_batch_items',
      new TableIndex({
        name: 'IDX_upload_batch_items_batch_created_at',
        columnNames: ['batchId', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'upload_batch_items',
      'IDX_upload_batch_items_batch_created_at',
    );
    await queryRunner.dropForeignKey(
      'upload_batch_items',
      'FK_upload_batch_items_batch_id',
    );
    await queryRunner.dropTable('upload_batch_items');
    await queryRunner.dropIndex(
      'upload_batches',
      'IDX_upload_batches_actor_expires_at',
    );
    await queryRunner.dropTable('upload_batches');
  }
}
