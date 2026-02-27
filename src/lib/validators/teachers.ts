import { z } from "zod";

export const createTeacherSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  phone: z.string().min(6).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido"),
});

export const updateTeacherSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(6).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional(),
  isActive: z.boolean().optional(),
});
