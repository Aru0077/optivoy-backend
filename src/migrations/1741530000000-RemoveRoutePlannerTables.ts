import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class RemoveRoutePlannerTables1741530000000 implements MigrationInterface {
  name = 'RemoveRoutePlannerTables1741530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "route_plan_hotels" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "route_plan_legs" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "route_plans" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "route_requests" CASCADE');

    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."route_leg_direction_enum"',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."route_plan_type_enum"',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."route_request_status_enum"',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.createTable(
      new Table({
        name: 'route_requests',
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
            name: 'originCity',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'originAirportCode',
            type: 'varchar',
            length: '8',
            isNullable: false,
          },
          {
            name: 'departDate',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'returnDate',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'adults',
            type: 'smallint',
            isNullable: false,
            default: 1,
          },
          {
            name: 'children',
            type: 'smallint',
            isNullable: false,
            default: 0,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '8',
            isNullable: false,
            default: "'CNY'",
          },
          {
            name: 'budgetLevel',
            type: 'varchar',
            length: '16',
            isNullable: false,
            default: "'standard'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'completed', 'failed'],
            enumName: 'route_request_status_enum',
            isNullable: false,
            default: "'pending'",
          },
          {
            name: 'providerContext',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'failureReason',
            type: 'jsonb',
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

    await queryRunner.createForeignKeys('route_requests', [
      new TableForeignKey({
        name: 'FK_route_requests_user_id',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_route_requests_spot_id',
        columnNames: ['spotId'],
        referencedTableName: 'spots',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createIndices('route_requests', [
      new TableIndex({
        name: 'IDX_route_requests_user_created_at',
        columnNames: ['userId', 'createdAt'],
      }),
      new TableIndex({
        name: 'IDX_route_requests_spot_depart_date',
        columnNames: ['spotId', 'departDate'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'route_plans',
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
            name: 'requestId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'planType',
            type: 'enum',
            enum: ['fastest', 'cheapest', 'nearest', 'balanced'],
            enumName: 'route_plan_type_enum',
            isNullable: false,
          },
          {
            name: 'totalPrice',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'totalDurationMinutes',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'transferCount',
            type: 'smallint',
            isNullable: false,
          },
          {
            name: 'detourRatio',
            type: 'double precision',
            isNullable: false,
          },
          {
            name: 'score',
            type: 'double precision',
            isNullable: false,
          },
          {
            name: 'outboundBookingUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'returnBookingUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'hotelBookingUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'providerPayload',
            type: 'jsonb',
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
            name: 'UQ_route_plans_request_plan_type',
            columnNames: ['requestId', 'planType'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'route_plans',
      new TableForeignKey({
        name: 'FK_route_plans_request_id',
        columnNames: ['requestId'],
        referencedTableName: 'route_requests',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'route_plans',
      new TableIndex({
        name: 'IDX_route_plans_request_id',
        columnNames: ['requestId'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'route_plan_legs',
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
            name: 'planId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'direction',
            type: 'enum',
            enum: ['outbound', 'return'],
            enumName: 'route_leg_direction_enum',
            isNullable: false,
          },
          {
            name: 'sequenceNo',
            type: 'smallint',
            isNullable: false,
          },
          {
            name: 'airlineCode',
            type: 'varchar',
            length: '16',
            isNullable: true,
          },
          {
            name: 'flightNumber',
            type: 'varchar',
            length: '24',
            isNullable: true,
          },
          {
            name: 'fromAirport',
            type: 'varchar',
            length: '8',
            isNullable: false,
          },
          {
            name: 'toAirport',
            type: 'varchar',
            length: '8',
            isNullable: false,
          },
          {
            name: 'departAt',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'arriveAt',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'durationMinutes',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'layoverMinutes',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'bookingUrl',
            type: 'varchar',
            length: '500',
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
      'route_plan_legs',
      new TableForeignKey({
        name: 'FK_route_plan_legs_plan_id',
        columnNames: ['planId'],
        referencedTableName: 'route_plans',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'route_plan_legs',
      new TableIndex({
        name: 'IDX_route_plan_legs_plan_direction_sequence',
        columnNames: ['planId', 'direction', 'sequenceNo'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'route_plan_hotels',
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
            name: 'planId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'hotelName',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'cityName',
            type: 'varchar',
            length: '120',
            isNullable: true,
          },
          {
            name: 'nights',
            type: 'smallint',
            isNullable: false,
          },
          {
            name: 'priceTotal',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'rating',
            type: 'double precision',
            isNullable: true,
          },
          {
            name: 'distanceKm',
            type: 'double precision',
            isNullable: true,
          },
          {
            name: 'bookingUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'providerPayload',
            type: 'jsonb',
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
      'route_plan_hotels',
      new TableForeignKey({
        name: 'FK_route_plan_hotels_plan_id',
        columnNames: ['planId'],
        referencedTableName: 'route_plans',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'route_plan_hotels',
      new TableIndex({
        name: 'IDX_route_plan_hotels_plan_id',
        columnNames: ['planId'],
      }),
    );
  }
}
