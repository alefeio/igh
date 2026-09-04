import { z } from "zod";

import { normalizeDigits } from "@/lib/validators/students";

/** Valor sentinela do formulário para “outro curso”. */
export const NEXT_CYCLE_OTHER_COURSE = "__other__";

export const nextCycleInterestSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo."),
    phone: z
      .string()
      .trim()
      .min(1, "Informe o telefone.")
      .transform((v) => normalizeDigits(v))
      .refine((v) => v.length >= 10 && v.length <= 11, "Telefone deve ter 10 ou 11 dígitos."),
    email: z
      .string()
      .trim()
      .min(1, "Informe o e-mail.")
      .email("E-mail inválido.")
      .toLowerCase()
      .max(160, "E-mail muito longo."),
    courseId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v == null || v === "" || v === NEXT_CYCLE_OTHER_COURSE ? null : v)),
    customCourseName: z
      .string()
      .trim()
      .max(160, "Nome do curso muito longo.")
      .optional()
      .nullable()
      .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
    captchaToken: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.courseId) return;
    if (!data.customCourseName || data.customCourseName.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["customCourseName"],
        message: "Selecione um curso ou digite o nome do curso pretendido.",
      });
    }
  });

export type NextCycleInterestInput = z.infer<typeof nextCycleInterestSchema>;
