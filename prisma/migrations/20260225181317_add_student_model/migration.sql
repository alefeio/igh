-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_SAY');

-- CreateEnum
CREATE TYPE "StudyShift" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'FULL');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('NONE', 'ELEMENTARY_INCOMPLETE', 'ELEMENTARY_COMPLETE', 'HIGH_INCOMPLETE', 'HIGH_COMPLETE', 'COLLEGE_INCOMPLETE', 'COLLEGE_COMPLETE', 'OTHER');

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "cpf" TEXT NOT NULL,
    "rg" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "hasDisability" BOOLEAN NOT NULL DEFAULT false,
    "disabilityDescription" TEXT,
    "educationLevel" "EducationLevel" NOT NULL,
    "isStudying" BOOLEAN NOT NULL DEFAULT false,
    "studyShift" "StudyShift",
    "guardianName" TEXT,
    "guardianCpf" TEXT,
    "guardianRg" TEXT,
    "guardianPhone" TEXT,
    "guardianRelationship" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_cpf_key" ON "Student"("cpf");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
