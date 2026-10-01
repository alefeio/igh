-- Indicadores pedagógicos aditivos: tipo de prova, motivo de saída e intervenção da coordenação.

CREATE TYPE "ClassGroupExamKind" AS ENUM ('DIAGNOSTIC', 'FORMATIVE', 'FINAL', 'OTHER');

ALTER TABLE "ClassGroupExam" ADD COLUMN "kind" "ClassGroupExamKind" NOT NULL DEFAULT 'OTHER';

CREATE TYPE "EnrollmentDepartureReason" AS ENUM (
  'WORK_SCHEDULE',
  'ADDRESS_CHANGE',
  'TRANSPORTATION',
  'HEALTH',
  'LOSS_OF_INTEREST',
  'EXPECTATION_MISMATCH',
  'LEARNING_DIFFICULTY',
  'METHODOLOGY_OR_TEACHER',
  'LACK_OF_EQUIPMENT',
  'EMPLOYMENT',
  'TRANSFER',
  'UNREACHABLE',
  'ABANDONMENT_WITHOUT_REASON',
  'ADMINISTRATIVE',
  'OTHER'
);

CREATE TABLE "EnrollmentDeparture" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "reason" "EnrollmentDepartureReason" NOT NULL,
  "note" TEXT,
  "courseProgressPercent" INTEGER,
  "presentCount" INTEGER,
  "sessionCount" INTEGER,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedByUserId" TEXT NOT NULL,
  CONSTRAINT "EnrollmentDeparture_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EnrollmentDeparture_enrollmentId_recordedAt_idx" ON "EnrollmentDeparture"("enrollmentId", "recordedAt");
CREATE INDEX "EnrollmentDeparture_recordedByUserId_idx" ON "EnrollmentDeparture"("recordedByUserId");

ALTER TABLE "EnrollmentDeparture" ADD CONSTRAINT "EnrollmentDeparture_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentDeparture" ADD CONSTRAINT "EnrollmentDeparture_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "CoordinatorInterventionType" AS ENUM ('ATTENDANCE', 'DROPOUT_RISK', 'PERFORMANCE', 'SUPPORT', 'BEHAVIOR', 'ACCESS', 'OTHER');
CREATE TYPE "CoordinatorInterventionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

CREATE TABLE "CoordinatorIntervention" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT,
  "classGroupId" TEXT,
  "cycleId" TEXT,
  "type" "CoordinatorInterventionType" NOT NULL,
  "problem" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "status" "CoordinatorInterventionStatus" NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "resultNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "attendancePercentBefore" INTEGER,
  "attendancePercentAfter" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoordinatorIntervention_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoordinatorIntervention_status_dueAt_idx" ON "CoordinatorIntervention"("status", "dueAt");
CREATE INDEX "CoordinatorIntervention_enrollmentId_idx" ON "CoordinatorIntervention"("enrollmentId");
CREATE INDEX "CoordinatorIntervention_classGroupId_idx" ON "CoordinatorIntervention"("classGroupId");
CREATE INDEX "CoordinatorIntervention_cycleId_idx" ON "CoordinatorIntervention"("cycleId");
CREATE INDEX "CoordinatorIntervention_ownerUserId_idx" ON "CoordinatorIntervention"("ownerUserId");
CREATE INDEX "CoordinatorIntervention_createdAt_idx" ON "CoordinatorIntervention"("createdAt");

ALTER TABLE "CoordinatorIntervention" ADD CONSTRAINT "CoordinatorIntervention_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoordinatorIntervention" ADD CONSTRAINT "CoordinatorIntervention_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CoordinatorIntervention" ADD CONSTRAINT "CoordinatorIntervention_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CoordinatorIntervention" ADD CONSTRAINT "CoordinatorIntervention_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
