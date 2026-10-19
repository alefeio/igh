-- O aluno pode dispensar o aviso de avaliação do professor no painel, sem apagar a chance de avaliar depois.

ALTER TABLE "Enrollment" ADD COLUMN "teacherEvaluationReminderDismissedAt" TIMESTAMP(3);
