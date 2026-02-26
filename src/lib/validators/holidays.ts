import { z } from "zod";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser no formato YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "Data inválida");

export const createHolidaySchema = z.object({
  recurring: z.boolean().optional(),
  date: dateStringSchema,
  name: z.string().max(200).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const updateHolidaySchema = z.object({
  recurring: z.boolean().optional(),
  date: dateStringSchema.optional(),
  name: z.string().max(200).optional().nullable(),
  isActive: z.boolean().optional(),
});
