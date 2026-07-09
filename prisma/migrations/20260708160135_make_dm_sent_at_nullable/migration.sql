-- AlterTable
ALTER TABLE "dm_records" ALTER COLUMN "dm_sent_at" DROP NOT NULL,
ALTER COLUMN "dm_sent_at" DROP DEFAULT;
