-- CreateTable
CREATE TABLE "PendingTestimonial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleOrContext" TEXT,
    "quote" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingTestimonial_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PendingTestimonial" ADD CONSTRAINT "PendingTestimonial_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
