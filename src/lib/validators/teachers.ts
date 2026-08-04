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

export const createTeacherSchema = z
  .object({
    /** Se informado, vincula perfil de professor a este usuário (sem criar conta nova). */
    userId: z.string().uuid().optional(),
    name: z.string().min(2, "Nome é obrigatório").optional(),
    phone: optionalPhone,
    email: z.string().email("E-mail inválido").optional(),
    birthDate: optionalBirthDateSchema,
    photoUrl: optionalPhoto,
    signatureUrl: optionalSignature,
  })
  .superRefine((data, ctx) => {
    if (data.userId) return;
    if (!data.name || data.name.trim().length < 2) {
      ctx.addIssue({ code: "custom", message: "Nome é obrigatório", path: ["name"] });
    }
    if (!data.email) {
      ctx.addIssue({ code: "custom", message: "E-mail inválido", path: ["email"] });
    }
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
