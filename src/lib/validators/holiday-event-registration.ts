import { z } from "zod";

import { normalizeDigits } from "@/lib/validators/students";

const optionalEmail = z
  .union([z.string().trim().email("E-mail inválido.").toLowerCase(), z.literal("")])
  .optional()
  .transform((v) => (v == null || v === "" ? null : v));

const optionalCpf = z
  .string()
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null || String(v).trim() === "") return null;
    return normalizeDigits(String(v));
  })
  .refine((v) => v == null || v.length === 11, "CPF deve ter 11 dígitos.");

export const guestHolidayEventRegisterSchema = z.object({
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  name: z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo."),
  phone: z
    .string()
    .trim()
    .min(1, "Informe o telefone.")
    .transform((v) => normalizeDigits(v))
    .refine((v) => v.length >= 10 && v.length <= 11, "Telefone deve ter 10 ou 11 dígitos."),
  email: optionalEmail,
  cpf: optionalCpf,
  captchaToken: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
});

export const adminHolidayEventRegisterSchema = z
  .object({
    holidayId: z.string().uuid("Evento inválido."),
    occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    /** Se informado, vincula a um usuário existente (por e-mail). */
    userEmail: z
      .string()
      .trim()
      .email("E-mail inválido.")
      .toLowerCase()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v == null || v === "" ? null : v)),
    name: z.string().trim().min(2, "Informe o nome.").max(120).optional().or(z.literal("")),
    phone: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v == null || v === "" ? null : normalizeDigits(v)))
      .refine((v) => v == null || (v.length >= 10 && v.length <= 11), "Telefone deve ter 10 ou 11 dígitos."),
    email: optionalEmail,
    cpf: optionalCpf,
  })
  .superRefine((data, ctx) => {
    if (data.userEmail) return;
    if (!data.name || data.name.trim().length < 2) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Informe o nome do participante." });
    }
    if (!data.phone) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Informe o telefone do participante." });
    }
  });
