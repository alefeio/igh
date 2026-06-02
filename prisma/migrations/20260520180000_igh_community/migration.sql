-- CreateEnum
CREATE TYPE "IghCommunityTopicKind" AS ENUM ('IDEA', 'TEAM', 'DISCUSSION');

-- CreateEnum
CREATE TYPE "IghCommunityPostStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "IghCommunityTopic" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" "IghCommunityTopicKind" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "IghCommunityPostStatus" NOT NULL DEFAULT 'PENDING',
    "moderatedAt" TIMESTAMP(3),
    "moderatedByUserId" TEXT,
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IghCommunityTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IghCommunityReply" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "IghCommunityPostStatus" NOT NULL DEFAULT 'PENDING',
    "moderatedAt" TIMESTAMP(3),
    "moderatedByUserId" TEXT,
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IghCommunityReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IghCommunityTopic_status_createdAt_idx" ON "IghCommunityTopic"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "IghCommunityTopic_studentId_idx" ON "IghCommunityTopic"("studentId");

-- CreateIndex
CREATE INDEX "IghCommunityTopic_kind_idx" ON "IghCommunityTopic"("kind");

-- CreateIndex
CREATE INDEX "IghCommunityReply_topicId_status_createdAt_idx" ON "IghCommunityReply"("topicId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IghCommunityReply_studentId_idx" ON "IghCommunityReply"("studentId");

-- AddForeignKey
ALTER TABLE "IghCommunityTopic" ADD CONSTRAINT "IghCommunityTopic_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IghCommunityTopic" ADD CONSTRAINT "IghCommunityTopic_moderatedByUserId_fkey" FOREIGN KEY ("moderatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IghCommunityReply" ADD CONSTRAINT "IghCommunityReply_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "IghCommunityTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IghCommunityReply" ADD CONSTRAINT "IghCommunityReply_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IghCommunityReply" ADD CONSTRAINT "IghCommunityReply_moderatedByUserId_fkey" FOREIGN KEY ("moderatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
