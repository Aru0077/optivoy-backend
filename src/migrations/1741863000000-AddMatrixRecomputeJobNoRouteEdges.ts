import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatrixRecomputeJobNoRouteEdges1741863000000
  implements MigrationInterface
{
  name = 'AddMatrixRecomputeJobNoRouteEdges1741863000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "matrix_recompute_jobs" ADD COLUMN "transitNoRouteEdges" integer NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "matrix_recompute_jobs" DROP COLUMN "transitNoRouteEdges"',
    );
  }
}
