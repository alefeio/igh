import { z } from "zod";

export const setupSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").toLowerCase(),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
});

/** Aceita `login` ou (legado) `email` no corpo da requisição. */
export const loginSchema = z
  .object({
    login: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1, "Senha é obrigatória"),
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
      return { login: lower, password: data.password, kind: "email" as const };
    }
    return { login: digits, password: data.password, kind: "cpf" as const };
  });
