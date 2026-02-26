import { z } from "zod";

const passwordMin = 6;

export const createTeacherSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  phone: z.string().min(6).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(passwordMin, `Senha deve ter no mínimo ${passwordMin} caracteres`),
});

export const updateTeacherSchema = z
  .object({
    name: z.string().min(2).optional(),
    phone: z.string().min(6).optional().or(z.literal("")),
    email: z.string().email("E-mail inválido").optional(),
    password: z.string().min(passwordMin).optional().or(z.literal("")),
    isActive: z.boolean().optional(),
  })
  .refine((data) => (data.password === "" || data.password === undefined) || data.password.length >= passwordMin, {
    message: `Senha deve ter no mínimo ${passwordMin} caracteres`,
    path: ["password"],
  });
