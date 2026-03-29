import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingIndexes1741280000000 implements MigrationInterface {
  name = 'AddMissingIndexes1741280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Spots: composite index for hot/new listings
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_spots_published_weight_created"
       ON "spots" ("isPublished", "adminWeight" DESC, "createdAt" DESC)`,
    );

    // Audit logs: query by actor
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actor_id_created"
       ON "audit_logs" ("actorId", "createdAt" DESC)
       WHERE "actorId" IS NOT NULL`,
    );

    // Users: query by status for admin list
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_status_created"
       ON "users" ("status", "createdAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_spots_published_weight_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_audit_logs_actor_id_created"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_status_created"`);
  }
}
