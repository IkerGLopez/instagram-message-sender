/*
  Warnings:

  - You are about to drop the `discount_codes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "discount_codes" DROP CONSTRAINT "discount_codes_instagram_user_id_fkey";

-- DropTable
DROP TABLE "discount_codes";

-- DropEnum
DROP TYPE "discount_status";
