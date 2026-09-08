import { z } from "zod";

const occurrenceDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data da ocorrência inválida.");

export const createHolidayEventRaffleSchema = z.object({
  occurrenceDate,
  title: z.string().trim().min(2, "Informe o nome do sorteio.").max(160, "Nome muito longo."),
  prize: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  order: z.number().int().min(0).max(999).optional(),
  allowRepeatWinner: z.boolean().optional(),
});

export const updateHolidayEventRaffleSchema = z.object({
  title: z.string().trim().min(2, "Informe o nome do sorteio.").max(160).optional(),
  prize: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  order: z.number().int().min(0).max(999).optional(),
  allowRepeatWinner: z.boolean().optional(),
  status: z.enum(["PENDING", "CANCELLED"]).optional(),
});

export const drawHolidayEventRaffleSchema = z.object({
  redraw: z.boolean().optional(),
});
