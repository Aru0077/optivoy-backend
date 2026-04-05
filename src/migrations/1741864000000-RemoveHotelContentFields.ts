import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveHotelContentFields1741864000000
  implements MigrationInterface
{
  name = 'RemoveHotelContentFields1741864000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hotels" DROP COLUMN "introI18n", DROP COLUMN "guideI18n", DROP COLUMN "noticeI18n"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hotels"
        ADD COLUMN "introI18n" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN "guideI18n" jsonb,
        ADD COLUMN "noticeI18n" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "hotels" ALTER COLUMN "introI18n" DROP DEFAULT`,
    );
  }
}
