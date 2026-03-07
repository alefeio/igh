import { z } from "zod";

const slugSchema = z.string().min(1).regex(/^[a-z0-9-]+$/).optional();

export const createCourseSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  slug: slugSchema,
  description: z.string().optional().or(z.literal("")),
  content: z.string().optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  workloadHours: z.number().int().positive().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
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
  videoUrl: z.union([z.string().url(), z.literal("")]).optional().nullable(),
  imageUrls: z.array(z.string().url()).optional(),
  contentRich: z.string().optional().nullable().or(z.literal("")),
});
