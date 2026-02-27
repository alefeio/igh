import { z } from "zod";

export const createAdminSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").toLowerCase(),
});

export const updateAdminSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório").optional(),
  email: z.string().email("E-mail inválido").toLowerCase().optional(),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});
