import { MigrationInterface, QueryRunner } from 'typeorm';

// Deprecated: openclaw module was fully removed in 1741731000000.
// This migration is intentionally kept as a no-op to preserve migration history.
export class OpenclawTasksAndSpotDrafts1741625000000 implements MigrationInterface {
  name = 'OpenclawTasksAndSpotDrafts1741625000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    await Promise.resolve();
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    await Promise.resolve();
  }
}
