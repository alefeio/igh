import { z } from "zod";
import { optionalBirthDateSchema } from "@/lib/validators/person-contact";

const optionalPhoto = z.union([z.literal(""), z.string().url("URL da foto inválida")]).optional();
const optionalSignature = z.union([z.literal(""), z.string().url("URL da assinatura inválida")]).optional();
const optionalPhone = z
  .union([z.string().trim().max(40), z.literal("")])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === "") return "";
    return v.replace(/\D/g, "").slice(0, 13);
  });

export const createTeacherSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  phone: optionalPhone,
  email: z.string().email("E-mail inválido"),
  birthDate: optionalBirthDateSchema,
  photoUrl: optionalPhoto,
  signatureUrl: optionalSignature,
});

export const updateTeacherSchema = z.object({
  name: z.string().min(2).optional(),
  phone: optionalPhone,
  email: z.string().email("E-mail inválido").optional(),
  birthDate: optionalBirthDateSchema,
  photoUrl: optionalPhoto,
  signatureUrl: optionalSignature,
  isActive: z.boolean().optional(),
});
