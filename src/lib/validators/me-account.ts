import { z } from "zod";

/** Atualização do próprio usuário (Master, Admin, Professor) em Meus dados. */
export const updateMeAccountSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres.").max(200),
  email: z.string().trim().email("E-mail inválido.").max(255),
  /** Apenas para professor; ignorado para Master/Admin. */
  phone: z
    .union([z.string().trim().max(40), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export type UpdateMeAccountInput = z.infer<typeof updateMeAccountSchema>;
