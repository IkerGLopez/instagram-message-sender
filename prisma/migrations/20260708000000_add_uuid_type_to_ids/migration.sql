/*
  Warnings:

  - The primary key for the `dm_records` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `instagram_comments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `instagram_followers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `webhook_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `dm_records` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `instagram_comments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `instagram_followers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `webhook_events` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "webhook_events_received_at_idx";

-- AlterTable
ALTER TABLE "dm_records" DROP CONSTRAINT "dm_records_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "dm_records_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "instagram_comments" DROP CONSTRAINT "instagram_comments_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "instagram_comments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "instagram_followers" DROP CONSTRAINT "instagram_followers_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "instagram_followers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "webhook_events" DROP CONSTRAINT "webhook_events_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events"("received_at" DESC);
