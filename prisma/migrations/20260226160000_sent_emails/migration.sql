-- CreateTable
CREATE TABLE "SentEmail" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "messageId" TEXT,
    "emailType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedByUserId" TEXT,

    CONSTRAINT "SentEmail_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SentEmail" ADD CONSTRAINT "SentEmail_performedByUserId_fkey" 
  FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
