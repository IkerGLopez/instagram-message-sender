-- DropTable
DROP TABLE "api_keys";

-- CreateTable
CREATE TABLE "instagram_comments" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "instagram_user_id" TEXT NOT NULL,
    "media_id" TEXT,
    "comment_text" TEXT NOT NULL,
    "commented_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_records" (
    "id" TEXT NOT NULL,
    "instagram_user_id" TEXT NOT NULL,
    "comment_id" TEXT,
    "media_id" TEXT,
    "discount_code" TEXT NOT NULL,
    "dm_message_id" TEXT,
    "dm_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dm_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_comments_comment_id_key" ON "instagram_comments"("comment_id");

-- CreateIndex
CREATE INDEX "instagram_comments_instagram_user_id_idx" ON "instagram_comments"("instagram_user_id");

-- CreateIndex
CREATE INDEX "instagram_comments_commented_at_idx" ON "instagram_comments"("commented_at");

-- CreateIndex
CREATE UNIQUE INDEX "dm_records_instagram_user_id_key" ON "dm_records"("instagram_user_id");

-- CreateIndex
CREATE INDEX "dm_records_instagram_user_id_idx" ON "dm_records"("instagram_user_id");

-- CreateIndex
CREATE INDEX "dm_records_dm_sent_at_idx" ON "dm_records"("dm_sent_at");
