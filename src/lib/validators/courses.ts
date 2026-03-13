import { z } from "zod";

const slugSchema = z.string().min(1).regex(/^[a-z0-9-]+$/).optional();

export const createCourseSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  slug: slugSchema,
  description: z.string().optional().or(z.literal("")),
  content: z.string().optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  workloadHours: z.number().int().positive().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "NOT_LISTED"]).optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

export const courseModuleSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional().or(z.literal("")),
  order: z.number().int().min(0),
});

export const courseLessonSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  order: z.number().int().min(0),
  durationMinutes: z.number().int().positive().optional().nullable(),
  videoUrl: z.union([z.string().url(), z.literal("")]).optional().nullable().transform((v) => (v === "" || v == null ? null : v)),
  imageUrls: z.array(z.string().url()).optional(),
  contentRich: z.string().optional().nullable().or(z.literal("")),
  summary: z.string().optional().nullable().or(z.literal("")),
  pdfUrl: z.union([z.string().url(), z.literal("")]).optional().nullable(),
  attachmentUrls: z.array(z.string().url()).optional(),
  attachmentNames: z.array(z.string()).optional(),
});

export const courseLessonExerciseOptionSchema = z.object({
  text: z.string().min(1, "Texto da opção é obrigatório"),
  isCorrect: z.boolean(),
});

export const courseLessonExerciseSchema = z
  .object({
    question: z.string().min(1, "Pergunta é obrigatória"),
    order: z.number().int().min(0).optional(),
    options: z.array(courseLessonExerciseOptionSchema).min(2, "Adicione pelo menos 2 opções").max(10, "Máximo 10 opções"),
  })
  .refine((data) => data.options.some((o) => o.isCorrect), { message: "Marque pelo menos uma opção como correta", path: ["options"] });
