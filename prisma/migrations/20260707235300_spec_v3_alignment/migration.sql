-- ============================================================
-- Spec v3.0.0 Alignment Migration
-- ============================================================
-- WebhookEvent: RENAME created_at→received_at, DROP updated_at, ADD processed_at
-- InstagramFollower: ADD unfollowedAt, followCount
-- ALL models: @db.VarChar(N) on String columns, @db.Timestamptz on DateTime columns

-- ============================================================
-- 1. webhook_events: RENAME, DROP, ADD
-- ============================================================

-- Rename created_at → received_at (preserves data)
ALTER TABLE "webhook_events" RENAME COLUMN "created_at" TO "received_at";

-- Drop updated_at (per SPECS.md v3.0.0: WebhookEvent has no updatedAt)
ALTER TABLE "webhook_events" DROP COLUMN "updated_at";

-- Add processed_at (nullable, set when event is processed)
ALTER TABLE "webhook_events" ADD COLUMN "processed_at" TIMESTAMPTZ;

-- Rename index from created_at to received_at
ALTER INDEX "webhook_events_created_at_idx" RENAME TO "webhook_events_received_at_idx";

-- Column type: event_type TEXT → VARCHAR(64)
ALTER TABLE "webhook_events" ALTER COLUMN "event_type" TYPE VARCHAR(64);

-- Column type: instagram_user_id TEXT → VARCHAR(64)
ALTER TABLE "webhook_events" ALTER COLUMN "instagram_user_id" TYPE VARCHAR(64);

-- Column type: received_at TIMESTAMP(3) → TIMESTAMPTZ
ALTER TABLE "webhook_events" ALTER COLUMN "received_at" TYPE TIMESTAMPTZ;

-- ============================================================
-- 2. instagram_followers: ADD columns + annotations
-- ============================================================

ALTER TABLE "instagram_followers" ADD COLUMN "unfollowed_at" TIMESTAMPTZ;
ALTER TABLE "instagram_followers" ADD COLUMN "follow_count" INTEGER NOT NULL DEFAULT 0;

-- Column type: instagram_user_id TEXT → VARCHAR(64)
ALTER TABLE "instagram_followers" ALTER COLUMN "instagram_user_id" TYPE VARCHAR(64);

-- Column type: followed_at TIMESTAMP(3) → TIMESTAMPTZ
ALTER TABLE "instagram_followers" ALTER COLUMN "followed_at" TYPE TIMESTAMPTZ;

-- Column type: created_at TIMESTAMP(3) → TIMESTAMPTZ
ALTER TABLE "instagram_followers" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- Column type: updated_at TIMESTAMP(3) → TIMESTAMPTZ
ALTER TABLE "instagram_followers" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- ============================================================
-- 3. instagram_comments: VARCHAR + TIMESTAMPTZ annotations
-- ============================================================

-- Column type: comment_id TEXT → VARCHAR(64)
ALTER TABLE "instagram_comments" ALTER COLUMN "comment_id" TYPE VARCHAR(64);

-- Column type: instagram_user_id TEXT → VARCHAR(64)
ALTER TABLE "instagram_comments" ALTER COLUMN "instagram_user_id" TYPE VARCHAR(64);

-- Column type: media_id TEXT → VARCHAR(64)
ALTER TABLE "instagram_comments" ALTER COLUMN "media_id" TYPE VARCHAR(64);

-- Column type: commented_at TIMESTAMP(3) → TIMESTAMPTZ
ALTER TABLE "instagram_comments" ALTER COLUMN "commented_at" TYPE TIMESTAMPTZ;

-- Column type: created_at TIMESTAMP(3) → TIMESTAMPTZ
ALTER TABLE "instagram_comments" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- Column type: updated_at TIMESTAMP(3) → TIMESTAMPTZ
ALTER TABLE "instagram_comments" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- ============================================================
-- 4. dm_records: VARCHAR + TIMESTAMPTZ annotations
-- ============================================================

-- Column type: instagram_user_id TEXT → VARCHAR(64)
ALTER TABLE "dm_records" ALTER COLUMN "instagram_user_id" TYPE VARCHAR(64);

-- Column type: comment_id TEXT → VARCHAR(64)
ALTER TABLE "dm_records" ALTER COLUMN "comment_id" TYPE VARCHAR(64);

-- Column type: media_id TEXT → VARCHAR(64)
ALTER TABLE "dm_records" ALTER COLUMN "media_id" TYPE VARCHAR(64);

-- Column type: discount_code TEXT → VARCHAR(64)
ALTER TABLE "dm_records" ALTER COLUMN "discount_code" TYPE VARCHAR(64);

-- Column type: dm_message_id TEXT → VARCHAR(128)
ALTER TABLE "dm_records" ALTER COLUMN "dm_message_id" TYPE VARCHAR(128);

-- Column type: dm_sent_at TIMESTAMP(3) → TIMESTAMPTZ
ALTER TABLE "dm_records" ALTER COLUMN "dm_sent_at" TYPE TIMESTAMPTZ;

-- Column type: created_at TIMESTAMP(3) → TIMESTAMPTZ
ALTER TABLE "dm_records" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- Column type: updated_at TIMESTAMP(3) → TIMESTAMPTZ
ALTER TABLE "dm_records" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;
