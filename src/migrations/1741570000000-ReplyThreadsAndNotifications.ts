import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class ReplyThreadsAndNotifications1741570000000 implements MigrationInterface {
  name = 'ReplyThreadsAndNotifications1741570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('spot_review_replies', [
      new TableColumn({
        name: 'parentReplyId',
        type: 'uuid',
        isNullable: true,
      }),
      new TableColumn({
        name: 'replyToUserId',
        type: 'uuid',
        isNullable: true,
      }),
    ]);

    await queryRunner.query(`
      UPDATE "spot_review_replies" AS reply
      SET "replyToUserId" = review."userId"
      FROM "spot_reviews" AS review
      WHERE reply."reviewId" = review.id
        AND reply."replyToUserId" IS NULL
    `);

    await queryRunner.createForeignKeys('spot_review_replies', [
      new TableForeignKey({
        name: 'FK_spot_review_replies_parent_reply_id',
        columnNames: ['parentReplyId'],
        referencedTableName: 'spot_review_replies',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'FK_spot_review_replies_reply_to_user_id',
        columnNames: ['replyToUserId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndices('spot_review_replies', [
      new TableIndex({
        name: 'IDX_spot_review_replies_parent_created_at',
        columnNames: ['parentReplyId', 'createdAt'],
      }),
      new TableIndex({
        name: 'IDX_spot_review_replies_reply_to_user_created_at',
        columnNames: ['replyToUserId', 'createdAt'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'user_notifications',
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
            enum: ['review_reply', 'reply_reply'],
            enumName: 'user_notification_type_enum',
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '160',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'data',
            type: 'jsonb',
            isNullable: false,
            default: "'{}'::jsonb",
          },
          {
            name: 'isRead',
            type: 'boolean',
            isNullable: false,
            default: 'false',
          },
          {
            name: 'readAt',
            type: 'timestamptz',
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
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'user_notifications',
      new TableForeignKey({
        name: 'FK_user_notifications_user_id',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndices('user_notifications', [
      new TableIndex({
        name: 'IDX_user_notifications_user_is_read_created_at',
        columnNames: ['userId', 'isRead', 'createdAt'],
      }),
      new TableIndex({
        name: 'IDX_user_notifications_user_created_at',
        columnNames: ['userId', 'createdAt'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'user_muted_review_threads',
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
            name: 'reviewId',
            type: 'uuid',
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
        uniques: [
          {
            name: 'UQ_user_muted_review_threads_user_review',
            columnNames: ['userId', 'reviewId'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('user_muted_review_threads', [
      new TableForeignKey({
        name: 'FK_user_muted_review_threads_user_id',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_user_muted_review_threads_review_id',
        columnNames: ['reviewId'],
        referencedTableName: 'spot_reviews',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createIndices('user_muted_review_threads', [
      new TableIndex({
        name: 'IDX_user_muted_review_threads_user_created_at',
        columnNames: ['userId', 'createdAt'],
      }),
      new TableIndex({
        name: 'IDX_user_muted_review_threads_review_user',
        columnNames: ['reviewId', 'userId'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'user_muted_review_threads',
      'IDX_user_muted_review_threads_review_user',
    );
    await queryRunner.dropIndex(
      'user_muted_review_threads',
      'IDX_user_muted_review_threads_user_created_at',
    );
    await queryRunner.dropForeignKey(
      'user_muted_review_threads',
      'FK_user_muted_review_threads_review_id',
    );
    await queryRunner.dropForeignKey(
      'user_muted_review_threads',
      'FK_user_muted_review_threads_user_id',
    );
    await queryRunner.dropTable('user_muted_review_threads', true);

    await queryRunner.dropIndex(
      'user_notifications',
      'IDX_user_notifications_user_created_at',
    );
    await queryRunner.dropIndex(
      'user_notifications',
      'IDX_user_notifications_user_is_read_created_at',
    );
    await queryRunner.dropForeignKey(
      'user_notifications',
      'FK_user_notifications_user_id',
    );
    await queryRunner.dropTable('user_notifications', true);
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."user_notification_type_enum"',
    );

    await queryRunner.dropIndex(
      'spot_review_replies',
      'IDX_spot_review_replies_reply_to_user_created_at',
    );
    await queryRunner.dropIndex(
      'spot_review_replies',
      'IDX_spot_review_replies_parent_created_at',
    );
    await queryRunner.dropForeignKey(
      'spot_review_replies',
      'FK_spot_review_replies_reply_to_user_id',
    );
    await queryRunner.dropForeignKey(
      'spot_review_replies',
      'FK_spot_review_replies_parent_reply_id',
    );
    await queryRunner.dropColumn('spot_review_replies', 'replyToUserId');
    await queryRunner.dropColumn('spot_review_replies', 'parentReplyId');
  }
}
