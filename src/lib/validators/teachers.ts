import { z } from "zod";

const optionalPhoto = z.union([z.literal(""), z.string().url("URL da foto inválida")]).optional();
const optionalSignature = z.union([z.literal(""), z.string().url("URL da assinatura inválida")]).optional();

export const createTeacherSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  phone: z.string().min(6).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido"),
  photoUrl: optionalPhoto,
  signatureUrl: optionalSignature,
});

export const updateTeacherSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(6).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional(),
  photoUrl: optionalPhoto,
  signatureUrl: optionalSignature,
  isActive: z.boolean().optional(),
});
