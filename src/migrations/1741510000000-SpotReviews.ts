import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class SpotReviews1741510000000 implements MigrationInterface {
  name = 'SpotReviews1741510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'spot_reviews',
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
            name: 'spotId',
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
            length: '2000',
            isNullable: false,
          },
          {
            name: 'imageUrls',
            type: 'varchar',
            isArray: true,
            isNullable: false,
            default: "'{}'",
          },
          {
            name: 'rating',
            type: 'smallint',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['published', 'hidden'],
            enumName: 'spot_review_status_enum',
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
        uniques: [
          {
            name: 'UQ_spot_reviews_user_spot',
            columnNames: ['userId', 'spotId'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('spot_reviews', [
      new TableForeignKey({
        name: 'FK_spot_reviews_spot_id',
        columnNames: ['spotId'],
        referencedTableName: 'spots',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_spot_reviews_user_id',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createIndices('spot_reviews', [
      new TableIndex({
        name: 'IDX_spot_reviews_spot_status_created_at',
        columnNames: ['spotId', 'status', 'createdAt'],
      }),
      new TableIndex({
        name: 'IDX_spot_reviews_user_created_at',
        columnNames: ['userId', 'createdAt'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'spot_reviews',
      'IDX_spot_reviews_user_created_at',
    );
    await queryRunner.dropIndex(
      'spot_reviews',
      'IDX_spot_reviews_spot_status_created_at',
    );
    await queryRunner.dropForeignKey('spot_reviews', 'FK_spot_reviews_user_id');
    await queryRunner.dropForeignKey('spot_reviews', 'FK_spot_reviews_spot_id');
    await queryRunner.dropTable('spot_reviews', true);
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."spot_review_status_enum"',
    );
  }
}
