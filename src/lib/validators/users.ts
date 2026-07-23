import { z } from "zod";
import { optionalBirthDateSchema, optionalPhoneDigitsSchema } from "@/lib/validators/person-contact";

export const createAdminSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").toLowerCase(),
  /** Padrão: ADMIN. */
  role: z.enum(["ADMIN", "COORDINATOR", "POLO_COORDINATOR"]).optional(),
  phone: optionalPhoneDigitsSchema,
  birthDate: optionalBirthDateSchema,
});

export const updateAdminSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório").optional(),
  email: z.string().email("E-mail inválido").toLowerCase().optional(),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  /** Alteração pelo Master entre perfis administrativos. */
  role: z.enum(["ADMIN", "COORDINATOR", "POLO_COORDINATOR"]).optional(),
  phone: optionalPhoneDigitsSchema,
  birthDate: optionalBirthDateSchema,
});
