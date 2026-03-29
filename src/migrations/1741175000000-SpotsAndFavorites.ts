import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class SpotsAndFavorites1741175000000 implements MigrationInterface {
  name = 'SpotsAndFavorites1741175000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'spots',
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
            name: 'name',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'country',
            type: 'varchar',
            length: '2',
            isNullable: false,
            default: "'CN'",
          },
          {
            name: 'city',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'airportCode',
            type: 'varchar',
            length: '8',
            isNullable: false,
          },
          {
            name: 'coverImageUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'imageUrls',
            type: 'varchar',
            isArray: true,
            isNullable: false,
            default: "'{}'",
          },
          {
            name: 'tags',
            type: 'varchar',
            isArray: true,
            isNullable: false,
            default: "'{}'",
          },
          {
            name: 'bestSeasons',
            type: 'varchar',
            isArray: true,
            isNullable: false,
            default: "'{}'",
          },
          {
            name: 'introI18n',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'adminWeight',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'favoriteCount',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'isPublished',
            type: 'boolean',
            isNullable: false,
            default: true,
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
      'spots',
      new TableIndex({
        name: 'IDX_spots_is_published_created_at',
        columnNames: ['isPublished', 'createdAt'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_favorites',
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
            name: 'spotId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        uniques: [
          {
            name: 'UQ_user_favorites_user_spot',
            columnNames: ['userId', 'spotId'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('user_favorites', [
      new TableForeignKey({
        name: 'FK_user_favorites_user_id',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_user_favorites_spot_id',
        columnNames: ['spotId'],
        referencedTableName: 'spots',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createIndices('user_favorites', [
      new TableIndex({
        name: 'IDX_user_favorites_user_created_at',
        columnNames: ['userId', 'createdAt'],
      }),
      new TableIndex({
        name: 'IDX_user_favorites_spot_created_at',
        columnNames: ['spotId', 'createdAt'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'spot_daily_metrics',
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
            name: 'date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'favoriteDelta',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'clickCount',
            type: 'integer',
            isNullable: false,
            default: 0,
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
            name: 'UQ_spot_daily_metrics_spot_date',
            columnNames: ['spotId', 'date'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'spot_daily_metrics',
      new TableForeignKey({
        name: 'FK_spot_daily_metrics_spot_id',
        columnNames: ['spotId'],
        referencedTableName: 'spots',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'spot_daily_metrics',
      new TableIndex({
        name: 'IDX_spot_daily_metrics_spot_date',
        columnNames: ['spotId', 'date'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'spot_daily_metrics',
      'IDX_spot_daily_metrics_spot_date',
    );
    await queryRunner.dropForeignKey(
      'spot_daily_metrics',
      'FK_spot_daily_metrics_spot_id',
    );
    await queryRunner.dropTable('spot_daily_metrics', true);

    await queryRunner.dropIndex(
      'user_favorites',
      'IDX_user_favorites_spot_created_at',
    );
    await queryRunner.dropIndex(
      'user_favorites',
      'IDX_user_favorites_user_created_at',
    );
    await queryRunner.dropForeignKey(
      'user_favorites',
      'FK_user_favorites_spot_id',
    );
    await queryRunner.dropForeignKey(
      'user_favorites',
      'FK_user_favorites_user_id',
    );
    await queryRunner.dropTable('user_favorites', true);

    await queryRunner.dropIndex('spots', 'IDX_spots_is_published_created_at');
    await queryRunner.dropTable('spots', true);
  }
}
