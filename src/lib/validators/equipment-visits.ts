import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const requiredDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

export const createEquipmentSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  quantityPerKit: z.number().int().min(0).optional().default(0),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateEquipmentSchema = createEquipmentSchema.partial();

const checklistItemSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  standard: z.string().trim().min(1),
  status: z.enum(["OK", "PENDENTE", "NAO_APLICAVEL"]),
  observation: optionalText,
  sortOrder: z.number().int().optional().default(0),
});

export const createTechnicalVisitSchema = z.object({
  locationName: z.string().trim().min(2, "Informe o nome do local"),
  municipality: z.string().trim().min(2, "Informe o município"),
  state: z.string().trim().min(2).optional().default("PA"),
  address: optionalText,
  localContact: optionalText,
  visitedAt: requiredDate,
  visitors: optionalText,
  metaStudents: z.number().int().min(0).nullable().optional(),
  metaClassGroups: z.number().int().min(0).nullable().optional(),
  metaStudentsPerClass: z.number().int().min(0).nullable().optional(),
  classDuration: optionalText,
  classesPerWeek: optionalText,
  classDays: optionalText,
  pedagogicalPlan: optionalText,
  structuralStandards: optionalText,
  finalClassification: z
    .enum(["APTA", "APTA_COM_PENDENCIAS", "INAPTA"])
    .optional()
    .default("APTA_COM_PENDENCIAS"),
  finalNotes: optionalText,
  donatariaId: z.string().uuid().nullable().optional(),
  checklistItems: z.array(checklistItemSchema).min(1, "Checklist obrigatório"),
});

export const updateTechnicalVisitSchema = createTechnicalVisitSchema.partial();
