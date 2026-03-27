import { z } from "zod";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser no formato YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "Data inválida");

const hmRefine = (data: { eventStartTime?: string | null; eventEndTime?: string | null }, ctx: z.RefinementCtx) => {
  const s = data.eventStartTime?.trim();
  const e = data.eventEndTime?.trim();
  if (!s && !e) return;
  if (!s || !e) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Evento exige horário de início e de fim.",
      path: ["eventEndTime"],
    });
    return;
  }
  const hm = /^\d{1,2}:\d{2}$/;
  if (!hm.test(s) || !hm.test(e)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Horários devem estar no formato HH:mm (ex.: 08:00).",
      path: ["eventStartTime"],
    });
    return;
  }
  const toM = (t: string) => {
    const [h, m] = t.split(":").map((x) => parseInt(x, 10));
    return h * 60 + m;
  };
  if (toM(e) <= toM(s)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O horário de fim deve ser depois do início (mesmo dia).",
      path: ["eventEndTime"],
    });
  }
};

export const createHolidaySchema = z
  .object({
    recurring: z.boolean().optional(),
    date: dateStringSchema,
    name: z.string().max(200).optional().or(z.literal("")),
    isActive: z.boolean().optional(),
    eventStartTime: z.string().max(8).optional().nullable(),
    eventEndTime: z.string().max(8).optional().nullable(),
  })
  .superRefine(hmRefine);

export const updateHolidaySchema = z.object({
  recurring: z.boolean().optional(),
  date: dateStringSchema.optional(),
  name: z.string().max(200).optional().nullable(),
  isActive: z.boolean().optional(),
  eventStartTime: z.string().max(8).optional().nullable(),
  eventEndTime: z.string().max(8).optional().nullable(),
});

/** Normaliza "8:00" → "08:00" para armazenamento. */
export function normalizeHolidayTimeHm(s: string): string {
  const parts = s.trim().split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return s.trim();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Valida par de horários de evento após merge no PATCH (feriado ↔ evento). */
export function validateHolidayEventTimesPair(
  eventStartTime: string | null | undefined,
  eventEndTime: string | null | undefined,
): string | null {
  const s = eventStartTime?.trim();
  const e = eventEndTime?.trim();
  if (!s && !e) return null;
  if (!s || !e) return "Evento exige horário de início e de fim.";
  const hm = /^\d{1,2}:\d{2}$/;
  if (!hm.test(s) || !hm.test(e)) return "Horários devem estar no formato HH:mm (ex.: 08:00).";
  const toM = (t: string) => {
    const [h, m] = t.split(":").map((x) => parseInt(x, 10));
    return h * 60 + m;
  };
  if (toM(e) <= toM(s)) return "O horário de fim deve ser depois do início (mesmo dia).";
  return null;
}
