-- Comentários opcionais por tópico (plataforma, aulas, professor)
ALTER TABLE "PlatformExperienceFeedback" ADD COLUMN IF NOT EXISTS "commentPlatform" TEXT;
ALTER TABLE "PlatformExperienceFeedback" ADD COLUMN IF NOT EXISTS "commentLessons" TEXT;
ALTER TABLE "PlatformExperienceFeedback" ADD COLUMN IF NOT EXISTS "commentTeacher" TEXT;
