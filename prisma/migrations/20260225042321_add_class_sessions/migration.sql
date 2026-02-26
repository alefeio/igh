/*
  Warnings:

  - You are about to drop the column `endDate` on the `ClassGroup` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `ClassGroup` table. All the data in the column will be lost.
  - You are about to drop the `ClassSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClassSession" DROP CONSTRAINT "ClassSession_classGroupId_fkey";

-- AlterTable
ALTER TABLE "ClassGroup" DROP COLUMN "endDate",
DROP COLUMN "startDate";

-- DropTable
DROP TABLE "ClassSession";

-- DropEnum
DROP TYPE "ClassSessionStatus";
