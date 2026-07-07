import { z } from "zod";

export const registerHolidayEventSchema = z.object({
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
});
