import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTravelRoutesModule1741730000000 implements MigrationInterface {
  name = 'RemoveTravelRoutesModule1741730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "user_route_customizations" CASCADE
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "travel_route_points" CASCADE
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "travel_routes" CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "travel_routes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "nameI18n" jsonb,
        "country" character varying(2) NOT NULL DEFAULT 'CN',
        "province" character varying(120) NOT NULL DEFAULT '',
        "provinceI18n" jsonb,
        "city" character varying(120) NOT NULL,
        "cityI18n" jsonb,
        "coverImageUrl" character varying(500),
        "descriptionI18n" jsonb,
        "totalSuggestedMinutes" integer NOT NULL DEFAULT 0,
        "isPublished" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_travel_routes_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "travel_route_points" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "routeId" uuid NOT NULL,
        "pointType" character varying(16) NOT NULL,
        "refId" uuid NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "durationMinutes" integer,
        "coverImageUrl" character varying(500),
        "name" character varying(120) NOT NULL,
        "nameI18n" jsonb,
        "province" character varying(120) NOT NULL DEFAULT '',
        "provinceI18n" jsonb,
        "city" character varying(120) NOT NULL,
        "cityI18n" jsonb,
        "latitude" double precision,
        "longitude" double precision,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_travel_route_points_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_TRAVEL_ROUTE_POINT_REF" UNIQUE ("routeId", "pointType", "refId"),
        CONSTRAINT "FK_TRAVEL_ROUTE_POINTS_ROUTE" FOREIGN KEY ("routeId") REFERENCES "travel_routes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_TRAVEL_ROUTE_POINTS_ROUTE_SORT" ON "travel_route_points" ("routeId", "sortOrder")
    `);

    await queryRunner.query(`
      CREATE TABLE "user_route_customizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "routeId" uuid NOT NULL,
        "removedPointIds" jsonb,
        "startDate" date,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_route_customizations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_USER_ROUTE_CUSTOMIZATION_USER_ROUTE" UNIQUE ("userId", "routeId"),
        CONSTRAINT "FK_USER_ROUTE_CUSTOMIZATION_ROUTE" FOREIGN KEY ("routeId") REFERENCES "travel_routes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_USER_ROUTE_CUSTOMIZATION_USER" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_USER_ROUTE_CUSTOMIZATION_USER" ON "user_route_customizations" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_USER_ROUTE_CUSTOMIZATION_ROUTE" ON "user_route_customizations" ("routeId")
    `);
  }
}
