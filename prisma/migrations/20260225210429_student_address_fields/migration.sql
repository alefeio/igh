/*
  Warnings:

  - You are about to drop the column `address` on the `Student` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Student" DROP COLUMN "address",
ADD COLUMN     "city" TEXT NOT NULL DEFAULT 'Belém',
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "neighborhood" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "number" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'PA',
ADD COLUMN     "street" TEXT NOT NULL DEFAULT '';
