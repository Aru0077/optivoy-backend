import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupSpotInteractionData1741705000000 implements MigrationInterface {
  name = 'CleanupSpotInteractionData1741705000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "spots" DROP COLUMN IF EXISTS "favoriteCount"',
    );

    await queryRunner.query(
      'DROP TABLE IF EXISTS "user_muted_review_threads" CASCADE',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS "spot_review_replies" CASCADE',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "spot_reviews" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "user_favorites" CASCADE');
    await queryRunner.query(
      'DROP TABLE IF EXISTS "spot_daily_metrics" CASCADE',
    );

    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."spot_review_reply_status_enum"',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."spot_review_status_enum"',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "spots" ADD COLUMN IF NOT EXISTS "favoriteCount" integer NOT NULL DEFAULT 0',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_favorites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "spotId" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_favorites_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_favorites_user_spot" UNIQUE ("userId", "spotId")
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_favorites_user_id'
        ) THEN
          ALTER TABLE "user_favorites"
            ADD CONSTRAINT "FK_user_favorites_user_id"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_favorites_spot_id'
        ) THEN
          ALTER TABLE "user_favorites"
            ADD CONSTRAINT "FK_user_favorites_spot_id"
            FOREIGN KEY ("spotId") REFERENCES "spots"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_user_favorites_user_created_at" ON "user_favorites" ("userId", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_user_favorites_spot_created_at" ON "user_favorites" ("spotId", "createdAt")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "spot_daily_metrics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spotId" uuid NOT NULL,
        "date" date NOT NULL,
        "favoriteDelta" integer NOT NULL DEFAULT 0,
        "clickCount" integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_spot_daily_metrics_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_spot_daily_metrics_spot_date" UNIQUE ("spotId", "date")
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_spot_daily_metrics_spot_id'
        ) THEN
          ALTER TABLE "spot_daily_metrics"
            ADD CONSTRAINT "FK_spot_daily_metrics_spot_id"
            FOREIGN KEY ("spotId") REFERENCES "spots"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_spot_daily_metrics_spot_date" ON "spot_daily_metrics" ("spotId", "date")',
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'spot_review_status_enum'
        ) THEN
          CREATE TYPE "public"."spot_review_status_enum" AS ENUM ('published', 'hidden');
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "spot_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spotId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "content" varchar(2000) NOT NULL,
        "imageUrls" varchar[] NOT NULL DEFAULT '{}',
        "rating" smallint NULL,
        "status" "public"."spot_review_status_enum" NOT NULL DEFAULT 'published',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_spot_reviews_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_spot_reviews_user_spot" UNIQUE ("userId", "spotId")
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_spot_reviews_spot_id'
        ) THEN
          ALTER TABLE "spot_reviews"
            ADD CONSTRAINT "FK_spot_reviews_spot_id"
            FOREIGN KEY ("spotId") REFERENCES "spots"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_spot_reviews_user_id'
        ) THEN
          ALTER TABLE "spot_reviews"
            ADD CONSTRAINT "FK_spot_reviews_user_id"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_spot_reviews_spot_status_created_at" ON "spot_reviews" ("spotId", "status", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_spot_reviews_user_created_at" ON "spot_reviews" ("userId", "createdAt")',
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'spot_review_reply_status_enum'
        ) THEN
          CREATE TYPE "public"."spot_review_reply_status_enum" AS ENUM ('published', 'hidden');
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "spot_review_replies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reviewId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "content" varchar(1000) NOT NULL,
        "status" "public"."spot_review_reply_status_enum" NOT NULL DEFAULT 'published',
        "parentReplyId" uuid NULL,
        "replyToUserId" uuid NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_spot_review_replies_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_spot_review_replies_review_id'
        ) THEN
          ALTER TABLE "spot_review_replies"
            ADD CONSTRAINT "FK_spot_review_replies_review_id"
            FOREIGN KEY ("reviewId") REFERENCES "spot_reviews"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_spot_review_replies_user_id'
        ) THEN
          ALTER TABLE "spot_review_replies"
            ADD CONSTRAINT "FK_spot_review_replies_user_id"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_spot_review_replies_parent_reply_id'
        ) THEN
          ALTER TABLE "spot_review_replies"
            ADD CONSTRAINT "FK_spot_review_replies_parent_reply_id"
            FOREIGN KEY ("parentReplyId") REFERENCES "spot_review_replies"("id") ON DELETE SET NULL;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_spot_review_replies_reply_to_user_id'
        ) THEN
          ALTER TABLE "spot_review_replies"
            ADD CONSTRAINT "FK_spot_review_replies_reply_to_user_id"
            FOREIGN KEY ("replyToUserId") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END$$;
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_spot_review_replies_review_status_created_at" ON "spot_review_replies" ("reviewId", "status", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_spot_review_replies_user_created_at" ON "spot_review_replies" ("userId", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_spot_review_replies_parent_created_at" ON "spot_review_replies" ("parentReplyId", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_spot_review_replies_reply_to_user_created_at" ON "spot_review_replies" ("replyToUserId", "createdAt")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_muted_review_threads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "reviewId" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_muted_review_threads_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_muted_review_threads_user_review" UNIQUE ("userId", "reviewId")
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_muted_review_threads_user_id'
        ) THEN
          ALTER TABLE "user_muted_review_threads"
            ADD CONSTRAINT "FK_user_muted_review_threads_user_id"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_muted_review_threads_review_id'
        ) THEN
          ALTER TABLE "user_muted_review_threads"
            ADD CONSTRAINT "FK_user_muted_review_threads_review_id"
            FOREIGN KEY ("reviewId") REFERENCES "spot_reviews"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_user_muted_review_threads_user_created_at" ON "user_muted_review_threads" ("userId", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_user_muted_review_threads_review_user" ON "user_muted_review_threads" ("reviewId", "userId")',
    );
  }
}
