import { z } from "zod";

import { appUuid, optionalAppUuid, nullableAppUuid } from "@/lib/validators/ids";

const daysSchema = z
  .array(z.string().min(2))
  .min(1, "Selecione ao menos um dia")
  .max(7, "Dias inválidos");

const teacherIdsSchema = z
  .array(appUuid)
  .min(1, "Selecione ao menos um professor")
  .max(20, "Máximo de 20 professores por turma");

const baseClassGroupFields = {
  cycleId: optionalAppUuid,
  courseId: appUuid,
  teacherIds: teacherIdsSchema,
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
  /** Local do polo (FK). Quando informado, a turma passa a pertencer ao polo daquele local. */
  poloLocationId: nullableAppUuid,
};

export const createClassGroupSchema = z.object(baseClassGroupFields);

export const updateClassGroupSchema = z
  .object({
    ...baseClassGroupFields,
    courseId: appUuid.optional(),
    teacherIds: teacherIdsSchema.optional(),
    daysOfWeek: daysSchema.optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início inválida (use o formato AAAA-MM-DD).")
      .optional(),
    startTime: z.string().min(3).optional(),
    endTime: z.string().min(3).optional(),
    capacity: z.number().int().positive().optional(),
  })
  .partial();
