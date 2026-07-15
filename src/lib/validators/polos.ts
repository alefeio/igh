import { z } from "zod";

const locationInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Nome do local é obrigatório").max(120),
  address: z.string().max(300).optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const createPoloSchema = z.object({
  name: z.string().min(2, "Nome do polo é obrigatório").max(120),
  coordinatorUserId: z.string().uuid("Selecione o coordenador do polo"),
  isActive: z.boolean().optional(),
  locations: z.array(locationInputSchema).max(50).optional(),
});

export const updatePoloSchema = z.object({
  name: z.string().min(2, "Nome do polo é obrigatório").max(120).optional(),
  coordinatorUserId: z.string().uuid("Selecione o coordenador do polo").optional(),
  isActive: z.boolean().optional(),
  /** Substitui a lista de locais (itens com id são atualizados; sem id são criados; omitidos são desativados). */
  locations: z.array(locationInputSchema).max(50).optional(),
});
