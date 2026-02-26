import { z } from "zod";

const timeSchema = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, "Use o formato HH:mm (ex.: 09:00 ou 10:30)");

export const createTimeSlotSchema = z.object({
  startTime: timeSchema,
  endTime: timeSchema,
  name: z.string().max(100).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const updateTimeSlotSchema = z.object({
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  name: z.string().max(100).optional().nullable(),
  isActive: z.boolean().optional(),
});
