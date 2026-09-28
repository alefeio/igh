import { z } from "zod";
import { SERVICE_CHANNELS, phoneDigits } from "@/lib/service-attendance";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      const text = value?.trim() ?? "";
      return text.length > 0 ? text : null;
    });

export const serviceAttendanceSchema = z.object({
  score: z.number({ error: "Escolha uma carinha." }).int().min(1, "Escolha uma carinha.").max(5),
  channel: z.enum(SERVICE_CHANNELS, { error: "Informe onde foi o atendimento." }),
  comment: optionalText(1000),
  name: optionalText(200),
  email: optionalText(200).refine((value) => value == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: "E-mail inválido.",
  }),
  phone: optionalText(20)
    .transform((value) => (value ? phoneDigits(value) : null))
    .refine((value) => value == null || (value.length >= 10 && value.length <= 11), {
      message: "Informe o telefone com DDD.",
    }),
});
