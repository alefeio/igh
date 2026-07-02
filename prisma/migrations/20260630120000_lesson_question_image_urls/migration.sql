-- Fotos anexadas às publicações do fórum da aula
ALTER TABLE "EnrollmentLessonQuestion" ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
