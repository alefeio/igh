-- Material de apoio do professor por turma (PDF, PowerPoint ou outro arquivo).
CREATE TABLE "ClassGroupTeacherMaterial" (
    "id" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassGroupTeacherMaterial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassGroupTeacherMaterial_classGroupId_createdAt_idx" ON "ClassGroupTeacherMaterial"("classGroupId", "createdAt");

CREATE INDEX "ClassGroupTeacherMaterial_uploadedByUserId_idx" ON "ClassGroupTeacherMaterial"("uploadedByUserId");

ALTER TABLE "ClassGroupTeacherMaterial" ADD CONSTRAINT "ClassGroupTeacherMaterial_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassGroupTeacherMaterial" ADD CONSTRAINT "ClassGroupTeacherMaterial_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
