import { z } from "zod";

const daysSchema = z
  .array(z.string().min(2))
  .min(1, "Selecione ao menos um dia")
  .max(7, "Dias inválidos");

export const createClassGroupSchema = z.object({
  courseId: z.string().uuid(),
  teacherId: z.string().uuid(),
  daysOfWeek: daysSchema,
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início inválida (use o formato AAAA-MM-DD)."),
  startTime: z.string().min(3),
  endTime: z.string().min(3),
  capacity: z.number().int().positive(),
  status: z
    .enum([
      "PLANEJADA",
      "ABERTA",
      "EM_ANDAMENTO",
      "ENCERRADA",
      "CANCELADA",
      "INTERNO",
      "EXTERNO",
    ])
    .optional(),
  location: z.string().optional().or(z.literal("")),
});

export const updateClassGroupSchema = createClassGroupSchema.partial();
