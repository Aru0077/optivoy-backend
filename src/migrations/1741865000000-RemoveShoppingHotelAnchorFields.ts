import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveShoppingHotelAnchorFields1741865000000
  implements MigrationInterface
{
  name = 'RemoveShoppingHotelAnchorFields1741865000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shopping_places"
        DROP COLUMN IF EXISTS "arrivalAnchorLatitude",
        DROP COLUMN IF EXISTS "arrivalAnchorLongitude",
        DROP COLUMN IF EXISTS "departureAnchorLatitude",
        DROP COLUMN IF EXISTS "departureAnchorLongitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hotels"
        DROP COLUMN IF EXISTS "arrivalAnchorLatitude",
        DROP COLUMN IF EXISTS "arrivalAnchorLongitude",
        DROP COLUMN IF EXISTS "departureAnchorLatitude",
        DROP COLUMN IF EXISTS "departureAnchorLongitude"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shopping_places"
        ADD COLUMN IF NOT EXISTS "arrivalAnchorLatitude" double precision,
        ADD COLUMN IF NOT EXISTS "arrivalAnchorLongitude" double precision,
        ADD COLUMN IF NOT EXISTS "departureAnchorLatitude" double precision,
        ADD COLUMN IF NOT EXISTS "departureAnchorLongitude" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "hotels"
        ADD COLUMN IF NOT EXISTS "arrivalAnchorLatitude" double precision,
        ADD COLUMN IF NOT EXISTS "arrivalAnchorLongitude" double precision,
        ADD COLUMN IF NOT EXISTS "departureAnchorLatitude" double precision,
        ADD COLUMN IF NOT EXISTS "departureAnchorLongitude" double precision`,
    );
  }
}
