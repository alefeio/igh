-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "attachmentNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
