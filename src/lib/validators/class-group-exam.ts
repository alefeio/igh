import { z } from "zod";

export const classGroupExamUpsertSchema = z
  .object({
    title: z.string().min(1, "Título é obrigatório"),
    instructions: z.string().optional().nullable(),
    availableFrom: z.string().min(1),
    availableUntil: z.string().min(1),
    durationMinutes: z.number().int().min(1).max(24 * 60),
    timingMode: z.enum(["FROM_STUDENT_START", "FROM_EXAM_START"]),
    selectionMode: z.enum(["RANDOM", "MANUAL"]),
    questionCount: z.number().int().min(1).max(200),
    manualExerciseIds: z.array(z.string().uuid()).optional(),
    shuffleQuestions: z.boolean().optional(),
    shuffleOptions: z.boolean().optional(),
    maxAttempts: z.number().int().min(1).max(5).optional(),
    showScoreAfterSubmit: z.boolean().optional(),
  })
  .refine((d) => new Date(d.availableUntil) > new Date(d.availableFrom), {
    message: "O término deve ser após o início da disponibilidade.",
    path: ["availableUntil"],
  });

export const examAnswerSchema = z.object({
  attemptQuestionId: z.string().uuid(),
  optionId: z.string().uuid(),
});

export const examSubmitSchema = z.object({
  answers: z.array(examAnswerSchema).optional(),
  abandon: z.boolean().optional(),
});
