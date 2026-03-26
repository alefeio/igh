-- CreateEnum
CREATE TYPE "CoordinatorReportStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateTable
CREATE TABLE "CoordinatorReport" (
    "id" TEXT NOT NULL,
    "protocolNumber" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "CoordinatorReportStatus" NOT NULL DEFAULT 'OPEN',
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attachmentNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unreadByCoordinator" BOOLEAN NOT NULL DEFAULT true,
    "unreadByReporter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoordinatorReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoordinatorReport_protocolNumber_key" ON "CoordinatorReport"("protocolNumber");
CREATE INDEX "CoordinatorReport_fromUserId_idx" ON "CoordinatorReport"("fromUserId");
CREATE INDEX "CoordinatorReport_updatedAt_idx" ON "CoordinatorReport"("updatedAt");

CREATE TABLE "CoordinatorReportMessage" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "isFromCoordinator" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attachmentNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoordinatorReportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoordinatorReportMessage_reportId_idx" ON "CoordinatorReportMessage"("reportId");

ALTER TABLE "CoordinatorReport" ADD CONSTRAINT "CoordinatorReport_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoordinatorReportMessage" ADD CONSTRAINT "CoordinatorReportMessage_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CoordinatorReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoordinatorReportMessage" ADD CONSTRAINT "CoordinatorReportMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
