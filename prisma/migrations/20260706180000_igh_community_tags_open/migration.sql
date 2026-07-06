-- Tags
CREATE TABLE "IghCommunityTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IghCommunityTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IghCommunityTopicTag" (
    "topicId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "IghCommunityTopicTag_pkey" PRIMARY KEY ("topicId","tagId")
);

CREATE UNIQUE INDEX "IghCommunityTag_name_key" ON "IghCommunityTag"("name");
CREATE INDEX "IghCommunityTag_name_idx" ON "IghCommunityTag"("name");
CREATE INDEX "IghCommunityTopicTag_tagId_idx" ON "IghCommunityTopicTag"("tagId");

ALTER TABLE "IghCommunityTopicTag" ADD CONSTRAINT "IghCommunityTopicTag_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "IghCommunityTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IghCommunityTopicTag" ADD CONSTRAINT "IghCommunityTopicTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "IghCommunityTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Author user (any registered portal user)
ALTER TABLE "IghCommunityTopic" ADD COLUMN "authorUserId" TEXT;
ALTER TABLE "IghCommunityReply" ADD COLUMN "authorUserId" TEXT;

UPDATE "IghCommunityTopic" t
SET "authorUserId" = s."userId"
FROM "Student" s
WHERE t."studentId" = s.id AND s."userId" IS NOT NULL;

UPDATE "IghCommunityReply" r
SET "authorUserId" = s."userId"
FROM "Student" s
WHERE r."studentId" = s.id AND s."userId" IS NOT NULL;

DELETE FROM "IghCommunityReply" WHERE "authorUserId" IS NULL;
DELETE FROM "IghCommunityTopic" WHERE "authorUserId" IS NULL;

ALTER TABLE "IghCommunityTopic" ALTER COLUMN "authorUserId" SET NOT NULL;
ALTER TABLE "IghCommunityReply" ALTER COLUMN "authorUserId" SET NOT NULL;

ALTER TABLE "IghCommunityTopic" ALTER COLUMN "studentId" DROP NOT NULL;
ALTER TABLE "IghCommunityReply" ALTER COLUMN "studentId" DROP NOT NULL;

ALTER TABLE "IghCommunityTopic" ALTER COLUMN "status" SET DEFAULT 'APPROVED';
ALTER TABLE "IghCommunityReply" ALTER COLUMN "status" SET DEFAULT 'APPROVED';

UPDATE "IghCommunityTopic" SET "status" = 'APPROVED' WHERE "status" = 'PENDING';
UPDATE "IghCommunityReply" SET "status" = 'APPROVED' WHERE "status" = 'PENDING';

ALTER TABLE "IghCommunityTopic" ADD CONSTRAINT "IghCommunityTopic_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IghCommunityReply" ADD CONSTRAINT "IghCommunityReply_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IghCommunityTopic" DROP CONSTRAINT IF EXISTS "IghCommunityTopic_studentId_fkey";
ALTER TABLE "IghCommunityReply" DROP CONSTRAINT IF EXISTS "IghCommunityReply_studentId_fkey";

ALTER TABLE "IghCommunityTopic" ADD CONSTRAINT "IghCommunityTopic_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IghCommunityReply" ADD CONSTRAINT "IghCommunityReply_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "IghCommunityTopic_authorUserId_idx" ON "IghCommunityTopic"("authorUserId");
CREATE INDEX "IghCommunityReply_authorUserId_idx" ON "IghCommunityReply"("authorUserId");
