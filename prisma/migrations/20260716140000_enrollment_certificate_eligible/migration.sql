-- Flag de elegibilidade a certificado por matrícula (auto ≥70% presença; override do professor).
ALTER TABLE "Enrollment" ADD COLUMN "certificateEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Enrollment" ADD COLUMN "certificateEligibleManual" BOOLEAN NOT NULL DEFAULT false;
