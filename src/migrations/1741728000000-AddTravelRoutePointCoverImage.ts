import { MigrationInterface, QueryRunner } from 'typeorm';

// Deprecated: travel-routes module was fully removed in 1741730000000.
// This migration is intentionally kept as a no-op to preserve migration history.
export class AddTravelRoutePointCoverImage1741728000000 implements MigrationInterface {
  name = 'AddTravelRoutePointCoverImage1741728000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    await Promise.resolve();
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    await Promise.resolve();
  }
}
