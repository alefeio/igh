import { z } from "zod";

export const setupSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").toLowerCase(),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo.").max(120, "Nome muito longo."),
  email: z.string().trim().email("Informe um e-mail válido.").toLowerCase(),
  whatsapp: z
    .string()
    .trim()
    .min(1, "Informe seu WhatsApp.")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 10 && v.length <= 11, "WhatsApp deve ter 10 ou 11 dígitos."),
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(72, "A senha deve ter no máximo 72 caracteres."),
  captchaToken: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
});

/** Aceita `login` ou (legado) `email` no corpo da requisição. */
export const loginSchema = z
  .object({
    login: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1, "Senha é obrigatória"),
    captchaToken: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const raw = (data.login ?? data.email ?? "").trim();
    if (!raw) {
      ctx.addIssue({
        code: "custom",
        path: ["login"],
        message: "Informe e-mail ou CPF.",
      });
      return;
    }
    const lower = raw.toLowerCase();
    const isEmail = z.string().email().safeParse(lower).success;
    const digits = raw.replace(/\D/g, "");
    const isCpf = digits.length === 11;
    if (!isEmail && !isCpf) {
      ctx.addIssue({
        code: "custom",
        path: ["login"],
        message: "Informe um e-mail válido ou CPF com 11 dígitos.",
      });
    }
  })
  .transform((data) => {
    const raw = (data.login ?? data.email ?? "").trim();
    const lower = raw.toLowerCase();
    const isEmail = z.string().email().safeParse(lower).success;
    const digits = raw.replace(/\D/g, "");
    if (isEmail) {
      return {
        login: lower,
        password: data.password,
        kind: "email" as const,
        captchaToken: data.captchaToken ?? null,
        website: data.website ?? null,
      };
    }
    return {
      login: digits,
      password: data.password,
      kind: "cpf" as const,
      captchaToken: data.captchaToken ?? null,
      website: data.website ?? null,
    };
  });
