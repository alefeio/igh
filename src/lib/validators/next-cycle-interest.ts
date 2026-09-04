import { z } from "zod";

import { normalizeDigits } from "@/lib/validators/students";

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
    courseIds: z
      .array(z.string().trim().uuid("Curso inválido."))
      .max(30, "Selecione no máximo 30 cursos.")
      .default([]),
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
    const hasCourses = data.courseIds.length > 0;
    const hasCustom = Boolean(data.customCourseName && data.customCourseName.length >= 2);
    if (!hasCourses && !hasCustom) {
      ctx.addIssue({
        code: "custom",
        path: ["courseIds"],
        message: "Selecione ao menos um curso ou digite o nome em “Outro”.",
      });
    }
  });

export type NextCycleInterestInput = z.infer<typeof nextCycleInterestSchema>;
