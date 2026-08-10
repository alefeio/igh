-- CreateTable
CREATE TABLE "DonorInstitutionSettings" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "document" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "cep" TEXT,
    "phone" TEXT,
    "representativeName" TEXT,
    "representativeRole" TEXT,
    "representativeCpf" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "DonorInstitutionSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DonorInstitutionSettings" ADD CONSTRAINT "DonorInstitutionSettings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
