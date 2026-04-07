import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHolidayCalendarDaysTable1741867000000
  implements MigrationInterface
{
  name = 'AddHolidayCalendarDaysTable1741867000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "holiday_calendar_days" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "date" date NOT NULL,
        "dayType" character varying(16) NOT NULL,
        "sourceYear" integer NOT NULL,
        "remark" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_holiday_calendar_days_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_holiday_calendar_days_date" UNIQUE ("date")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_holiday_calendar_days_source_year"
      ON "holiday_calendar_days" ("sourceYear")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_holiday_calendar_days_source_year"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "holiday_calendar_days"
    `);
  }
}
