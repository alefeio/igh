import { z } from "zod";

export const createCourseSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  description: z.string().optional().or(z.literal("")),
  content: z.string().optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  workloadHours: z.number().int().positive().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const updateCourseSchema = createCourseSchema.partial();
