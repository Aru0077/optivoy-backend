import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class SpotReviewReplies1741515000000 implements MigrationInterface {
  name = 'SpotReviewReplies1741515000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'spot_review_replies',
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
            name: 'reviewId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'varchar',
            length: '1000',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['published', 'hidden'],
            enumName: 'spot_review_reply_status_enum',
            isNullable: false,
            default: "'published'",
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

    await queryRunner.createForeignKeys('spot_review_replies', [
      new TableForeignKey({
        name: 'FK_spot_review_replies_review_id',
        columnNames: ['reviewId'],
        referencedTableName: 'spot_reviews',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_spot_review_replies_user_id',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createIndices('spot_review_replies', [
      new TableIndex({
        name: 'IDX_spot_review_replies_review_status_created_at',
        columnNames: ['reviewId', 'status', 'createdAt'],
      }),
      new TableIndex({
        name: 'IDX_spot_review_replies_user_created_at',
        columnNames: ['userId', 'createdAt'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'spot_review_replies',
      'IDX_spot_review_replies_user_created_at',
    );
    await queryRunner.dropIndex(
      'spot_review_replies',
      'IDX_spot_review_replies_review_status_created_at',
    );
    await queryRunner.dropForeignKey(
      'spot_review_replies',
      'FK_spot_review_replies_user_id',
    );
    await queryRunner.dropForeignKey(
      'spot_review_replies',
      'FK_spot_review_replies_review_id',
    );
    await queryRunner.dropTable('spot_review_replies', true);
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."spot_review_reply_status_enum"',
    );
  }
}
