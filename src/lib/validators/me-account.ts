import { z } from "zod";
import { optionalBirthDateSchema, optionalPhoneDigitsSchema } from "@/lib/validators/person-contact";

/** Atualização do próprio usuário (Master, Admin, Coordenador, Professor) em Meus dados. */
export const updateMeAccountSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres.").max(200),
  email: z.string().trim().email("E-mail inválido.").max(255),
  phone: optionalPhoneDigitsSchema,
  birthDate: optionalBirthDateSchema,
});

export type UpdateMeAccountInput = z.infer<typeof updateMeAccountSchema>;
