import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatrixRecomputeJobsTable1741748000000
  implements MigrationInterface
{
  name = 'AddMatrixRecomputeJobsTable1741748000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "matrix_recompute_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scope" character varying(16) NOT NULL,
        "city" character varying(120) NOT NULL,
        "province" character varying(120),
        "pointId" uuid,
        "pointType" character varying(16),
        "modes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "totalEdges" integer NOT NULL DEFAULT 0,
        "processedEdges" integer NOT NULL DEFAULT 0,
        "transitReadyEdges" integer NOT NULL DEFAULT 0,
        "transitFallbackEdges" integer NOT NULL DEFAULT 0,
        "drivingReadyEdges" integer NOT NULL DEFAULT 0,
        "walkingReadyEdges" integer NOT NULL DEFAULT 0,
        "walkingMinutesReadyEdges" integer NOT NULL DEFAULT 0,
        "message" text,
        "lastError" text,
        "startedAt" timestamp,
        "finishedAt" timestamp,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_matrix_recompute_jobs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_matrix_recompute_jobs_status_created"
      ON "matrix_recompute_jobs" ("status", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_matrix_recompute_jobs_city_province_created"
      ON "matrix_recompute_jobs" ("city", "province", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_matrix_recompute_jobs_city_province_created"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_matrix_recompute_jobs_status_created"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "matrix_recompute_jobs"
    `);
  }
}
