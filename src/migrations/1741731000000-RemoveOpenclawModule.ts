import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveOpenclawModule1741731000000 implements MigrationInterface {
  name = 'RemoveOpenclawModule1741731000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "spot_drafts" CASCADE
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "openclaw_tasks" CASCADE
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "spot_draft_status_enum"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "openclaw_task_status_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'openclaw_task_status_enum') THEN
          CREATE TYPE "openclaw_task_status_enum" AS ENUM ('pending', 'running', 'completed', 'failed', 'canceled');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'spot_draft_status_enum') THEN
          CREATE TYPE "spot_draft_status_enum" AS ENUM ('pending_review', 'rejected', 'published');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "openclaw_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "taskType" character varying(64) NOT NULL,
        "status" "openclaw_task_status_enum" NOT NULL,
        "title" character varying(180) NOT NULL,
        "instruction" text,
        "payload" jsonb,
        "progress" jsonb,
        "resultSummary" text,
        "errorMessage" text,
        "startedAt" timestamptz,
        "completedAt" timestamptz,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_openclaw_tasks_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_openclaw_tasks_status_created_at" ON "openclaw_tasks" ("status", "createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "spot_drafts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "taskId" uuid,
        "source" character varying(64) NOT NULL,
        "sourceTaskId" character varying(128),
        "sourceUrl" character varying(1024),
        "sourceFingerprint" character varying(128) NOT NULL,
        "title" character varying(180),
        "status" "spot_draft_status_enum" NOT NULL,
        "rawPayload" jsonb,
        "normalizedPayload" jsonb NOT NULL,
        "reviewNote" character varying(500),
        "reviewedBy" uuid,
        "reviewedAt" timestamptz,
        "publishedSpotId" uuid,
        "publishedAt" timestamptz,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_spot_drafts_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_spot_drafts_source_fingerprint" ON "spot_drafts" ("source", "sourceFingerprint")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_spot_drafts_status_created_at" ON "spot_drafts" ("status", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_spot_drafts_task_created_at" ON "spot_drafts" ("taskId", "createdAt")
    `);
    await queryRunner
      .query(
        `
      ALTER TABLE "spot_drafts"
      ADD CONSTRAINT "FK_spot_drafts_task_id"
      FOREIGN KEY ("taskId")
      REFERENCES "openclaw_tasks"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `,
      )
      .catch(() => undefined);
    await queryRunner
      .query(
        `
      ALTER TABLE "spot_drafts"
      ADD CONSTRAINT "FK_spot_drafts_published_spot_id"
      FOREIGN KEY ("publishedSpotId")
      REFERENCES "spots"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `,
      )
      .catch(() => undefined);
  }
}
