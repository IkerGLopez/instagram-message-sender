-- AlterTable
ALTER TABLE "dm_records" ADD COLUMN "dm_send_attempted_at" TIMESTAMPTZ;

-- DropIndex (redundant: instagram_user_id already has a unique index)
DROP INDEX IF EXISTS "dm_records_instagram_user_id_idx";
