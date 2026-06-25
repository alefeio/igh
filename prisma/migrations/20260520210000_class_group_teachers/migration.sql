-- CreateTable
CREATE TABLE "ClassGroupTeacher" (
    "id" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassGroupTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassGroupTeacher_classGroupId_teacherId_key" ON "ClassGroupTeacher"("classGroupId", "teacherId");

-- CreateIndex
CREATE INDEX "ClassGroupTeacher_teacherId_idx" ON "ClassGroupTeacher"("teacherId");

-- AddForeignKey
ALTER TABLE "ClassGroupTeacher" ADD CONSTRAINT "ClassGroupTeacher_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassGroupTeacher" ADD CONSTRAINT "ClassGroupTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from primary teacherId
INSERT INTO "ClassGroupTeacher" ("id", "classGroupId", "teacherId", "createdAt")
SELECT gen_random_uuid()::text, "id", "teacherId", NOW()
FROM "ClassGroup";
