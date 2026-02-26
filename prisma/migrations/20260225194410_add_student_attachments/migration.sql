-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('ID_DOCUMENT', 'ADDRESS_PROOF');

-- CreateTable
CREATE TABLE "StudentAttachment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StudentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentAttachment_studentId_type_idx" ON "StudentAttachment"("studentId", "type");

-- AddForeignKey
ALTER TABLE "StudentAttachment" ADD CONSTRAINT "StudentAttachment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttachment" ADD CONSTRAINT "StudentAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
